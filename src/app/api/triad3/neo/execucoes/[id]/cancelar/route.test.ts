import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/neo/orchestrator");

import * as orchestrator from "@/server/neo/orchestrator";
import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "e1" }) };

describe("POST /api/triad3/neo/execucoes/[id]/cancelar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("rejects requests from an untrusted cross-site origin", async () => {
    const response = await POST(new Request("http://localhost/x", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }), ctx);
    expect(response.status).toBe(403);
  });

  it("returns 404 for another user's execution", async () => {
    vi.mocked(orchestrator.cancelNeoExecution).mockResolvedValue({ ok: false, error: { type: "not_found", message: "Recurso não encontrado.", httpStatus: 404 } });
    const response = await POST(new Request("http://localhost/x", { method: "POST" }), ctx);
    expect(response.status).toBe(404);
    expect(orchestrator.cancelNeoExecution).toHaveBeenCalledWith("u1", "e1");
  });

  it("cancels and reports whether it was already finished", async () => {
    vi.mocked(orchestrator.cancelNeoExecution).mockResolvedValue({ ok: true, jaFinalizada: false });
    const response = await POST(new Request("http://localhost/x", { method: "POST" }), ctx);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, jaFinalizada: false });
  });
});
