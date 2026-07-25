import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/db/repositories/neo-conversas");
vi.mock("@/server/neo/orchestrator");

import * as conversasRepo from "@/server/db/repositories/neo-conversas";
import * as orchestrator from "@/server/neo/orchestrator";
import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "c1" }) };

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/triad3/neo/conversas/c1/executar", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

async function readAllFrames(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe("POST /api/triad3/neo/conversas/[id]/executar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
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
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 without starting an execution for a conversation the caller doesn't own", async () => {
    vi.mocked(conversasRepo.buscarConversaPorId).mockResolvedValue(null);
    const response = await POST(postRequest({ mensagem: "oi" }), ctx);
    expect(response.status).toBe(404);
    expect(orchestrator.startNeoExecution).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    const response = await POST(postRequest({ mensagem: "" }), ctx);
    expect(response.status).toBe(400);
  });

  it("rejects a message over the configured length limit", async () => {
    const response = await POST(postRequest({ mensagem: "a".repeat(10_000) }), ctx);
    expect(response.status).toBe(400);
  });

  it("surfaces a rate_limit error (e.g. concurrent execution limit) as a normal JSON error, not a stream", async () => {
    vi.mocked(orchestrator.startNeoExecution).mockResolvedValue({
      ok: false,
      error: { type: "rate_limit", message: "Limite temporário atingido.", httpStatus: 429 },
    });
    const response = await POST(postRequest({ mensagem: "investigar algo" }), ctx);
    expect(response.status).toBe(429);
  });

  it("streams SSE with the correct headers and content type on success", async () => {
    vi.mocked(orchestrator.startNeoExecution).mockResolvedValue({ ok: true, execucaoId: "e1", mensagemUsuarioId: "m1", alreadyExists: false });
    vi.mocked(orchestrator.runNeoExecution).mockResolvedValue(undefined);
    const response = await POST(postRequest({ mensagem: "investigar algo" }), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("idempotent replay (alreadyExists) emits a single event and closes without re-running the orchestrator", async () => {
    vi.mocked(orchestrator.startNeoExecution).mockResolvedValue({ ok: true, execucaoId: "e1", mensagemUsuarioId: "m1", alreadyExists: true });
    const response = await POST(postRequest({ mensagem: "investigar algo", idempotencyKey: "k1" }), ctx);
    const text = await readAllFrames(response);
    expect(text).toContain("execucao.iniciada");
    expect(orchestrator.runNeoExecution).not.toHaveBeenCalled();
  });

  it("passes continuarExecucaoId through to the orchestrator so 'Continuar investigação' seeds from the previous run", async () => {
    vi.mocked(orchestrator.startNeoExecution).mockResolvedValue({ ok: true, execucaoId: "e2", mensagemUsuarioId: "m2", alreadyExists: false });
    vi.mocked(orchestrator.runNeoExecution).mockResolvedValue(undefined);
    await POST(postRequest({ mensagem: "continue", continuarExecucaoId: "exec-anterior" }), ctx);
    expect(orchestrator.runNeoExecution).toHaveBeenCalledWith(expect.objectContaining({ continuarExecucaoId: "exec-anterior" }));
  });
});
