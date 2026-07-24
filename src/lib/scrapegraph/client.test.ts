import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sgaiRequest } from "./client";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("sgaiRequest", () => {
  const originalEnv = process.env.SGAI_API_KEY;

  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.SGAI_API_KEY = originalEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns a configuration error when SGAI_API_KEY is missing", async () => {
    delete process.env.SGAI_API_KEY;
    const result = await sgaiRequest("GET", "/credits");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("configuration");
  });

  it("returns parsed JSON on success without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { remaining: 100 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sgaiRequest("GET", "/credits");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ remaining: 100 });
  });

  it("never sends the raw request body headers back in the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    await sgaiRequest("POST", "/scrape", { body: { url: "https://example.com" } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["SGAI-APIKEY"]).toBe("test-key");
  });

  it("does not retry on a 400 validation error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(400, { message: "Campo inválido" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sgaiRequest("POST", "/scrape", { body: {} });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("validation");
  });

  it("does not retry on a 401/403 auth error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: "sem chave" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sgaiRequest("GET", "/credits");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
  });

  it("retries on 429 respecting Retry-After and eventually succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { message: "limite" }, { "retry-after": "0" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sgaiRequest("GET", "/credits");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  }, 10_000);

  it("stops after 3 attempts on persistent 5xx errors", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(503, { message: "indisponível" }, { "retry-after": "0" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sgaiRequest("GET", "/credits");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("server_error");
  }, 10_000);
});
