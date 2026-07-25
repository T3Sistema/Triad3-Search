import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/db/repositories/neo-execucoes");
vi.mock("@/server/neo/orchestrator");

import * as execucoesRepo from "@/server/db/repositories/neo-execucoes";
import * as orchestrator from "@/server/neo/orchestrator";
import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "e1" }) };

function postRequest(body: unknown) {
  return new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

const execucaoRow = {
  id: "e1",
  conversaId: "c1",
  mensagemUsuarioId: "m1",
  usuarioId: "u1",
  status: "aguardando_confirmacao" as const,
  plano: null,
  camposSolicitados: null,
  camposEncontrados: null,
  camposAusentes: null,
  erroPublico: null,
  idempotencyKey: null,
  contextoPendente: {},
  iniciadoEm: "t",
  concluidoEm: null,
  canceladoEm: null,
  totalFerramentas: 1,
  tokensEntrada: null,
  tokensSaida: null,
  ultimoHeartbeatEm: null,
};

describe("POST /api/triad3/neo/execucoes/[id]/formulario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 for another user's execution", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(null);
    const response = await POST(postRequest({ valores: { url: "https://a.example" } }), ctx);
    expect(response.status).toBe(404);
    expect(orchestrator.resumeNeoExecutionAfterForm).not.toHaveBeenCalled();
  });

  it("rejects submitting values for an execution that isn't waiting on the user", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue({ ...execucaoRow, status: "concluida" });
    const response = await POST(postRequest({ valores: { url: "https://a.example" } }), ctx);
    expect(response.status).toBe(400);
    expect(orchestrator.resumeNeoExecutionAfterForm).not.toHaveBeenCalled();
  });

  it("rejects a malformed valores payload", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(execucaoRow);
    const response = await POST(postRequest({ valores: { url: { nested: "object not allowed" } } }), ctx);
    expect(response.status).toBe(400);
    expect(orchestrator.resumeNeoExecutionAfterForm).not.toHaveBeenCalled();
  });

  it("passes the submitted values through to the resume function, scoped to the authenticated user's own execução", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(execucaoRow);
    vi.mocked(orchestrator.resumeNeoExecutionAfterForm).mockResolvedValue(undefined);
    const response = await POST(postRequest({ valores: { url: "https://carango.com.br", frequencia: "diaria" } }), ctx);
    expect(response.status).toBe(200);
    const call = vi.mocked(orchestrator.resumeNeoExecutionAfterForm).mock.calls[0]![0];
    expect(call).toEqual(
      expect.objectContaining({ usuarioId: "u1", conversaId: "c1", execucaoId: "e1", valores: { url: "https://carango.com.br", frequencia: "diaria" } }),
    );
  });

  it("streams SSE for the resumed execution", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(execucaoRow);
    vi.mocked(orchestrator.resumeNeoExecutionAfterForm).mockResolvedValue(undefined);
    const response = await POST(postRequest({ valores: {} }), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });
});
