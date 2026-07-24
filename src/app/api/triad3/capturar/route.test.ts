import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/triad3/capturar", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("POST /api/triad3/capturar", () => {
  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects requests from an untrusted cross-site origin", async () => {
    const response = await POST(
      makeRequest({ url: "https://example.com", formats: [{ type: "markdown" }] }, { "sec-fetch-site": "cross-site" }),
    );
    expect(response.status).toBe(403);
  });

  it("returns a validation error for a missing url", async () => {
    const response = await POST(makeRequest({ formats: [{ type: "markdown" }] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.type).toBe("validation");
  });

  it("rejects a non-http(s) URL", async () => {
    const response = await POST(makeRequest({ url: "javascript:alert(1)", formats: [{ type: "markdown" }] }));
    expect(response.status).toBe(400);
  });

  it("requires a prompt for the json format", async () => {
    const response = await POST(makeRequest({ url: "https://example.com", formats: [{ type: "json" }] }));
    expect(response.status).toBe(400);
  });

  it("forwards a valid payload and returns the upstream JSON untouched", async () => {
    const upstream = { id: "abc-123", results: { markdown: { data: ["conteúdo"] } } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, upstream));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      makeRequest({ url: "https://example.com", formats: [{ type: "markdown", mode: "normal" }] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstream);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("https://v2-api.scrapegraphai.com/api/scrape");
    expect((calledInit.headers as Record<string, string>)["SGAI-APIKEY"]).toBe("test-key");
  });

  it("never leaks the vendor auth header or base URL into the response sent to the browser", async () => {
    const upstream = { id: "abc-123", results: { markdown: { data: ["conteúdo"] } } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, upstream)));

    const response = await POST(makeRequest({ url: "https://example.com", formats: [{ type: "markdown" }] }));
    const text = await response.text();

    expect(text).not.toContain("SGAI-APIKEY");
    expect(text).not.toContain("v2-api.scrapegraphai.com");
    expect(text.toLowerCase()).not.toContain("scrapegraphai");
  });
});
