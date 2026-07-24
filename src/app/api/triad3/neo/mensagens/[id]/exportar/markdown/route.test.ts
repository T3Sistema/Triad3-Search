import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/neo/export/context");

import * as contextMod from "@/server/neo/export/context";
import { GET } from "./route";
import { NEO_ANSWER_VERSION } from "@/lib/neo/answer";

const ctx = { params: Promise.resolve({ id: "m1" }) };

describe("GET /api/triad3/neo/mensagens/[id]/exportar/markdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 when the message doesn't belong to the caller (ownership enforced before export)", async () => {
    vi.mocked(contextMod.loadNeoExportContext).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), ctx);
    expect(response.status).toBe(404);
    expect(contextMod.loadNeoExportContext).toHaveBeenCalledWith("u1", "m1");
  });

  it("returns a downloadable markdown file with the correct content type on success", async () => {
    vi.mocked(contextMod.loadNeoExportContext).mockResolvedValue({
      mensagemId: "m1",
      conversaId: "c1",
      perguntaOriginal: "pergunta",
      answer: {
        version: NEO_ANSWER_VERSION,
        status: "completo",
        titulo: "Relatório",
        resumoExecutivo: "resumo",
        blocos: [],
        fontes: [],
        informacoesAusentes: [],
        observacoes: [],
        proximasAcoes: [],
        perguntaNecessaria: null,
      },
    });
    const response = await GET(new Request("http://localhost/x"), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/markdown");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    const text = await response.text();
    expect(text).toContain("# Relatório");
  });
});
