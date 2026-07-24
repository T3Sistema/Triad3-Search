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
  return new Request("http://localhost/api/triad3/extrair", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/triad3/extrair", () => {
  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a request with no source and no prompt", async () => {
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects more than one source at once", async () => {
    const response = await POST(makeRequest({ url: "https://example.com", html: "<p>x</p>", prompt: "Extraia o título." }));
    expect(response.status).toBe(400);
  });

  it("extracts using a single valid source and returns the upstream JSON untouched", async () => {
    const upstream = { id: "abc", json: { title: "Exemplo" } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, upstream));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(makeRequest({ url: "https://example.com", prompt: "Extraia o título." }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstream);
  });
});
