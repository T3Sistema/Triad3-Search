import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});

import { GET, POST } from "./route";

beforeEach(() => {
  requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/triad3/monitoramentos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/triad3/monitoramentos", () => {
  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects an invalid cron interval", async () => {
    const response = await POST(
      makeRequest({ name: "Meu monitor", url: "https://example.com", interval: "not-a-cron", formats: [{ type: "markdown" }] }),
    );
    expect(response.status).toBe(400);
  });

  it("creates a monitor with a valid payload", async () => {
    const upstream = { cronId: "mon-1", status: "active", interval: "0 9 * * *" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, upstream)));

    const response = await POST(
      makeRequest({ name: "Meu monitor", url: "https://example.com", interval: "0 9 * * *", formats: [{ type: "markdown" }] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstream);
  });
});

describe("GET /api/triad3/monitoramentos", () => {
  beforeEach(() => {
    process.env.SGAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists monitors", async () => {
    const upstream = { data: [{ cronId: "mon-1", status: "active" }], pagination: { limit: 20 } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, upstream)));

    const response = await GET(new Request("http://localhost/api/triad3/monitoramentos?limit=20"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(upstream);
  });
});
