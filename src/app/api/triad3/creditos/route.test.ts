import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("GET /api/triad3/creditos", () => {
  const originalKey = process.env.SGAI_API_KEY;

  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.SGAI_API_KEY = originalKey;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns a friendly configuration error when the key is missing", async () => {
    delete process.env.SGAI_API_KEY;
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.type).toBe("configuration");
    expect(body.error.message).toContain("integração");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("never mentions the vendor name in the error body sent to the browser", async () => {
    delete process.env.SGAI_API_KEY;
    const response = await GET();
    const text = await response.text();

    expect(text.toLowerCase()).not.toContain("scrapegraphai");
    expect(text.toLowerCase()).not.toMatch(/\bsgai\b/);
  });

  it("passes through the upstream JSON untouched, including unknown fields", async () => {
    const upstreamBody = { remaining: 750000, used: 287, plan: "Pro Plan", futureField: "abc" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, upstreamBody)));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstreamBody);
  });

  it("translates an upstream 402 into a payment_required envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(402, { message: "no credits" })));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.error.type).toBe("payment_required");
  });
});
