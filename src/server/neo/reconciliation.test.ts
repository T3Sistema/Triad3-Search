import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db/repositories/neo-execucoes");
vi.mock("@/server/db/repositories/neo-mensagens");
vi.mock("@/server/db/repositories/neo-etapas");
vi.mock("@/server/db/repositories/neo-fontes");

import * as execucoesRepo from "@/server/db/repositories/neo-execucoes";
import * as mensagensRepo from "@/server/db/repositories/neo-mensagens";
import * as etapasRepo from "@/server/db/repositories/neo-etapas";
import * as fontesRepo from "@/server/db/repositories/neo-fontes";
import { reconcileConversationExecution } from "@/server/neo/reconciliation";
import { registerNeoExecution, unregisterNeoExecution } from "@/server/neo/execution-registry";
import { NEO_EXECUTION_BUDGET } from "@/server/neo/budget";
import { NEO_LIMITS } from "@/server/neo/limits";

const ORPHAN_THRESHOLD_MS = NEO_EXECUTION_BUDGET.totalBudgetMs + NEO_EXECUTION_BUDGET.synthesisReserveMs + NEO_LIMITS.orphanGraceMs;

const execucaoBase = {
  id: "exec1",
  conversaId: "conv1",
  mensagemUsuarioId: "msgU1",
  usuarioId: "u1",
  status: "executando" as const,
  plano: null,
  camposSolicitados: null,
  camposEncontrados: null,
  camposAusentes: null,
  erroPublico: null,
  idempotencyKey: null,
  contextoPendente: null,
  iniciadoEm: new Date(Date.now() - ORPHAN_THRESHOLD_MS - 60_000).toISOString(),
  concluidoEm: null,
  canceladoEm: null,
  totalFerramentas: 0,
  tokensEntrada: null,
  tokensSaida: null,
  ultimoHeartbeatEm: null,
};

const mensagemBase = {
  id: "msgA1",
  conversaId: "conv1",
  usuarioId: "u1",
  papel: "assistente" as const,
  conteudo: null,
  respostaEstruturada: null,
  status: "em_execucao" as const,
  execucaoId: "exec1",
  criadoEm: "t",
};

function etapa(overrides: { id: string; status: string; tipo?: string; ordem?: number }) {
  return {
    execucaoId: "exec1",
    ordem: 1,
    tipo: "ferramenta",
    nomePublico: "Pesquisando na web",
    ferramentaInterna: "pesquisar_web",
    argumentosSanitizados: { q: "x" },
    resultadoResumido: { resultados: [{ url: "https://a.com" }] },
    iniciadoEm: "t",
    concluidoEm: null,
    erroPublico: null,
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(etapasRepo.atualizarEtapa).mockResolvedValue(undefined);
  vi.mocked(execucoesRepo.atualizarExecucao).mockResolvedValue(undefined);
  vi.mocked(mensagensRepo.atualizarMensagem).mockResolvedValue(undefined);
  vi.mocked(fontesRepo.listarFontes).mockResolvedValue([]);
});

describe("reconcileConversationExecution", () => {
  it("does nothing when the conversation has no execution", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue(null);
    await reconcileConversationExecution("conv1");
    expect(execucoesRepo.atualizarExecucao).not.toHaveBeenCalled();
  });

  it("does nothing when the execution is active and its heartbeat is still recent", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue({
      ...execucaoBase,
      ultimoHeartbeatEm: new Date().toISOString(),
    });
    await reconcileConversationExecution("conv1");
    expect(execucoesRepo.atualizarExecucao).not.toHaveBeenCalled();
    expect(etapasRepo.listarEtapas).not.toHaveBeenCalled();
  });

  it("never touches an execution genuinely still running in this same process", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue(execucaoBase); // stale heartbeat
    const controller = new AbortController();
    registerNeoExecution("exec1", controller);
    try {
      await reconcileConversationExecution("conv1");
      expect(execucoesRepo.atualizarExecucao).not.toHaveBeenCalled();
    } finally {
      unregisterNeoExecution("exec1");
    }
  });

  it("incident repro: 9 completed searches (no extraction) + 1 abandoned step become nao_concluido with totalFerramentas=9 and a synced message", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue(execucaoBase);
    const concluidas = Array.from({ length: 9 }, (_, i) => etapa({ id: `etapa-${i}`, status: "concluida", ordem: i + 1 }));
    const abandonada = etapa({ id: "etapa-10", status: "em_execucao", ordem: 10 });
    vi.mocked(etapasRepo.listarEtapas).mockResolvedValue([...concluidas, abandonada]);
    vi.mocked(mensagensRepo.buscarMensagemPorExecucaoId).mockResolvedValue(mensagemBase);

    await reconcileConversationExecution("conv1");

    expect(etapasRepo.atualizarEtapa).toHaveBeenCalledWith(
      "etapa-10",
      expect.objectContaining({ status: "falhou", erroPublico: expect.stringContaining("interrompida") }),
    );
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith(
      "exec1",
      expect.objectContaining({ status: "parcial", totalFerramentas: 9, erroPublico: null }),
    );
    expect(mensagensRepo.atualizarMensagem).toHaveBeenCalledWith(
      "msgA1",
      expect.objectContaining({ status: "parcial", respostaEstruturada: expect.objectContaining({ status: "nao_concluido" }) }),
    );
    const [, atualizacao] = vi.mocked(mensagensRepo.atualizarMensagem).mock.calls[0];
    expect(JSON.stringify(atualizacao)).not.toContain("Pesquisando na web");
  });

  it("finalizes as falhou when there is no usable evidence at all", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue(execucaoBase);
    vi.mocked(etapasRepo.listarEtapas).mockResolvedValue([etapa({ id: "etapa-1", status: "em_execucao" })]);
    vi.mocked(mensagensRepo.buscarMensagemPorExecucaoId).mockResolvedValue(mensagemBase);

    await reconcileConversationExecution("conv1");

    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith(
      "exec1",
      expect.objectContaining({ status: "falhou", totalFerramentas: 0, erroPublico: "A execução foi interrompida antes da preparação do relatório." }),
    );
    expect(mensagensRepo.atualizarMensagem).toHaveBeenCalledWith(
      "msgA1",
      expect.objectContaining({ status: "falhou", conteudo: "A execução foi interrompida antes da preparação do relatório." }),
    );
  });

  it("abandons a dangling confirmation step as cancelada instead of falhou", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue(execucaoBase);
    vi.mocked(etapasRepo.listarEtapas).mockResolvedValue([etapa({ id: "etapa-c", status: "aguardando", tipo: "confirmacao" })]);
    vi.mocked(mensagensRepo.buscarMensagemPorExecucaoId).mockResolvedValue(mensagemBase);

    await reconcileConversationExecution("conv1");

    expect(etapasRepo.atualizarEtapa).toHaveBeenCalledWith("etapa-c", expect.objectContaining({ status: "cancelada" }));
  });

  it("the exact incident scenario: execução already falhou (fixed directly in the database), mensagem still em_execucao — syncs without any new SQL", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue({
      ...execucaoBase,
      status: "falhou",
      erroPublico: "A execução foi interrompida antes da preparação do relatório.",
      concluidoEm: new Date().toISOString(),
      totalFerramentas: 9,
    });
    vi.mocked(mensagensRepo.buscarMensagemPorExecucaoId).mockResolvedValue(mensagemBase);

    await reconcileConversationExecution("conv1");

    // Already-terminal execução is never re-finalized — only the drifted message is synced.
    expect(execucoesRepo.atualizarExecucao).not.toHaveBeenCalled();
    expect(mensagensRepo.atualizarMensagem).toHaveBeenCalledWith(
      "msgA1",
      expect.objectContaining({ status: "falhou", conteudo: "A execução foi interrompida antes da preparação do relatório." }),
    );
  });

  it("is idempotent: does nothing when the message is already terminal and already has content", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue({ ...execucaoBase, status: "falhou", erroPublico: "x" });
    vi.mocked(mensagensRepo.buscarMensagemPorExecucaoId).mockResolvedValue({ ...mensagemBase, status: "falhou", conteudo: "x" });

    await reconcileConversationExecution("conv1");

    expect(mensagensRepo.atualizarMensagem).not.toHaveBeenCalled();
  });

  it("does nothing when there is no message linked to the execution", async () => {
    vi.mocked(execucoesRepo.buscarUltimaExecucaoPorConversa).mockResolvedValue({ ...execucaoBase, status: "falhou", erroPublico: "x" });
    vi.mocked(mensagensRepo.buscarMensagemPorExecucaoId).mockResolvedValue(null);

    await reconcileConversationExecution("conv1");

    expect(mensagensRepo.atualizarMensagem).not.toHaveBeenCalled();
  });
});
