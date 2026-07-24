import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("GET /api/triad3/historico", () => {
  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects an invalid service filter", async () => {
    const response = await GET(new Request("http://localhost/api/triad3/historico?service=not-a-service"));
    expect(response.status).toBe(400);
  });

  it("lists history entries untouched", async () => {
    const upstream = { data: [{ id: "h1", service: "scrape", status: "completed" }], pagination: { page: 1, limit: 20, total: 1 } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, upstream)));

    const response = await GET(new Request("http://localhost/api/triad3/historico?page=1&limit=20"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstream);
  });
});
