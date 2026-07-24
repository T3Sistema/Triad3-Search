import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/db/repositories/neo-execucoes");
vi.mock("@/server/db/repositories/neo-etapas");

import * as execucoesRepo from "@/server/db/repositories/neo-execucoes";
import * as etapasRepo from "@/server/db/repositories/neo-etapas";
import { GET } from "./route";

const ctx = { params: Promise.resolve({ id: "e1" }) };

describe("GET /api/triad3/neo/execucoes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 for an execution that isn't the caller's (repository filters by usuarioId)", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), ctx);
    expect(response.status).toBe(404);
    expect(execucoesRepo.buscarExecucaoPorId).toHaveBeenCalledWith("u1", "e1");
  });

  it("returns status and steps without any raw tool JSON in the body", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue({
      id: "e1",
      conversaId: "c1",
      mensagemUsuarioId: "m1",
      usuarioId: "u1",
      status: "concluida",
      plano: { objetivoInterpretado: "x" },
      camposSolicitados: [],
      camposEncontrados: [],
      camposAusentes: [],
      erroPublico: null,
      idempotencyKey: null,
      contextoPendente: null,
      iniciadoEm: "t",
      concluidoEm: "t",
      canceladoEm: null,
      totalFerramentas: 1,
      tokensEntrada: 10,
      tokensSaida: 10,
      ultimoHeartbeatEm: null,
    });
    vi.mocked(etapasRepo.listarEtapas).mockResolvedValue([
      {
        id: "etapa1",
        execucaoId: "e1",
        ordem: 1,
        tipo: "ferramenta",
        nomePublico: "Pesquisando",
        ferramentaInterna: "pesquisar_web",
        status: "concluida",
        argumentosSanitizados: { q: "x" },
        resultadoResumido: { resultados: [] },
        iniciadoEm: "t",
        concluidoEm: "t",
        erroPublico: null,
      },
    ]);
    const response = await GET(new Request("http://localhost/x"), ctx);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.etapas[0]).not.toHaveProperty("ferramentaInterna");
    expect(body.etapas[0]).not.toHaveProperty("argumentosSanitizados");
    expect(body.etapas[0].nomePublico).toBe("Pesquisando");
  });
});
