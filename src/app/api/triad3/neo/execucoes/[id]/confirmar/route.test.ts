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

describe("POST /api/triad3/neo/execucoes/[id]/confirmar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 for another user's execution (never accepts a confirmation for a foreign resource)", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(null);
    const response = await POST(postRequest({ confirmar: true }), ctx);
    expect(response.status).toBe(404);
    expect(orchestrator.resumeNeoExecutionAfterConfirmation).not.toHaveBeenCalled();
  });

  it("rejects confirming an execution that isn't actually waiting for confirmation", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue({ ...execucaoRow, status: "concluida" });
    const response = await POST(postRequest({ confirmar: true }), ctx);
    expect(response.status).toBe(400);
    expect(orchestrator.resumeNeoExecutionAfterConfirmation).not.toHaveBeenCalled();
  });

  it("only ever accepts a boolean confirmar flag — never a modified copy of the pending tool arguments", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(execucaoRow);
    vi.mocked(orchestrator.resumeNeoExecutionAfterConfirmation).mockResolvedValue(undefined);
    // Even if a malicious client tries to smuggle different arguments, the schema only reads `confirmar`.
    const response = await POST(postRequest({ confirmar: true, monitoramentoId: "outro-id-malicioso", args: { url: "https://evil.example" } }), ctx);
    expect(response.status).toBe(200);
    const call = vi.mocked(orchestrator.resumeNeoExecutionAfterConfirmation).mock.calls[0]![0];
    expect(call).toEqual(
      expect.objectContaining({ usuarioId: "u1", conversaId: "c1", execucaoId: "e1", confirmado: true }),
    );
    expect(call).not.toHaveProperty("monitoramentoId");
    expect(call).not.toHaveProperty("args");
  });

  it("streams SSE for the resumed execution", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(execucaoRow);
    vi.mocked(orchestrator.resumeNeoExecutionAfterConfirmation).mockResolvedValue(undefined);
    const response = await POST(postRequest({ confirmar: false }), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });
});
