import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/db/repositories/neo-conversas");
vi.mock("@/server/db/repositories/neo-mensagens");

import * as conversasRepo from "@/server/db/repositories/neo-conversas";
import * as mensagensRepo from "@/server/db/repositories/neo-mensagens";
import { GET } from "./route";

const ctx = { params: Promise.resolve({ id: "c1" }) };

describe("GET /api/triad3/neo/conversas/[id]/mensagens", () => {
  beforeEach(() => {
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 without listing messages when the conversation isn't owned by the caller", async () => {
    vi.mocked(conversasRepo.buscarConversaPorId).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), ctx);
    expect(response.status).toBe(404);
    expect(mensagensRepo.listarMensagens).not.toHaveBeenCalled();
  });

  it("lists messages once ownership is confirmed", async () => {
    vi.mocked(conversasRepo.buscarConversaPorId).mockResolvedValue({
      id: "c1",
      usuarioId: "u1",
      titulo: "t",
      resumoContexto: null,
      entidadesAtivas: null,
      status: "ativa",
      criadoEm: "t",
      atualizadoEm: "t",
    });
    vi.mocked(mensagensRepo.listarMensagens).mockResolvedValue([]);
    const response = await GET(new Request("http://localhost/x"), ctx);
    expect(response.status).toBe(200);
    expect(mensagensRepo.listarMensagens).toHaveBeenCalledWith("c1", expect.anything());
  });
});
