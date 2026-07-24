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
  return new Request("http://localhost/api/triad3/pesquisar", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/triad3/pesquisar", () => {
  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a request with no query", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects a schema without a prompt", async () => {
    const response = await POST(makeRequest({ query: "teste", schema: { type: "object" } }));
    expect(response.status).toBe(400);
  });

  it("returns results and never censors legitimate content the user searched for", async () => {
    const upstream = {
      id: "abc",
      results: [
        { url: "https://acme.example", title: "Acme Corp e ScrapeGraphAI fecham parceria", content: "A empresa ScrapeGraphAI anunciou hoje..." },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, upstream)));

    const response = await POST(makeRequest({ query: "acme scrapegraphai parceria" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    // The search result content is the user's own data — it must pass through untouched,
    // even though it mentions a vendor name.
    expect(body).toEqual(upstream);
  });
});
