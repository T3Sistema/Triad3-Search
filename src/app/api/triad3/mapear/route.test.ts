import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});

import { POST } from "./route";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/triad3/mapear", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/triad3/mapear", () => {
  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a request with no url", async () => {
    const response = await POST(makeRequest({ formats: [{ type: "links" }] }));
    expect(response.status).toBe(400);
  });

  it("applies default values and starts a crawl", async () => {
    const upstream = { id: "crawl-1", status: "running", total: 0, finished: 0, pages: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, upstream));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ url: "https://example.com", formats: [{ type: "links" }] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstream);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.maxPages).toBe(50);
    expect(sentBody.maxDepth).toBe(2);
    expect(sentBody.allowExternal).toBe(false);
  });
});
