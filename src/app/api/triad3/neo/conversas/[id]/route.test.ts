import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/db/repositories/neo-conversas");

import * as conversasRepo from "@/server/db/repositories/neo-conversas";
import { GET, PATCH, DELETE } from "./route";

const ctx = { params: Promise.resolve({ id: "c1" }) };

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/triad3/neo/conversas/c1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("/api/triad3/neo/conversas/[id]", () => {
  beforeEach(() => {
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("GET returns 404 for a conversation belonging to a different user (repository already filters by usuarioId)", async () => {
    vi.mocked(conversasRepo.buscarConversaPorId).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/triad3/neo/conversas/c1"), { params: Promise.resolve({ id: "c1" }) });
    expect(response.status).toBe(404);
    expect(conversasRepo.buscarConversaPorId).toHaveBeenCalledWith("u1", "c1");
  });

  it("PATCH updates only fields owned by the authenticated user, rejecting an empty payload", async () => {
    const response = await PATCH(patchRequest({}), ctx);
    expect(response.status).toBe(400);
    expect(conversasRepo.atualizarConversa).not.toHaveBeenCalled();
  });

  it("PATCH returns 404 when trying to rename another user's conversation", async () => {
    vi.mocked(conversasRepo.atualizarConversa).mockResolvedValue(null);
    const response = await PATCH(patchRequest({ titulo: "Novo título" }), ctx);
    expect(response.status).toBe(404);
    expect(conversasRepo.atualizarConversa).toHaveBeenCalledWith("u1", "c1", { titulo: "Novo título" });
  });

  it("DELETE soft-deletes only when the conversation belongs to the authenticated user", async () => {
    vi.mocked(conversasRepo.excluirConversa).mockResolvedValue(false);
    const response = await DELETE(new Request("http://localhost/api/triad3/neo/conversas/c1", { method: "DELETE" }), ctx);
    expect(response.status).toBe(404);
    expect(conversasRepo.excluirConversa).toHaveBeenCalledWith("u1", "c1");
  });

  it("DELETE rejects requests from an untrusted cross-site origin", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/triad3/neo/conversas/c1", { method: "DELETE", headers: { "sec-fetch-site": "cross-site" } }),
      ctx,
    );
    expect(response.status).toBe(403);
  });
});
