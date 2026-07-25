import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NeoEvent } from "@/lib/neo/events";

vi.mock("@/server/neo/tools", () => ({}));
vi.mock("@/server/db/repositories/neo-conversas");
vi.mock("@/server/db/repositories/neo-mensagens");
vi.mock("@/server/db/repositories/neo-execucoes");
vi.mock("@/server/db/repositories/neo-etapas");
vi.mock("@/server/db/repositories/neo-fontes");
vi.mock("@/server/neo/agent");
vi.mock("@/server/neo/memory");
vi.mock("@/server/neo/budget", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/neo/budget")>();
  return { ...actual, createExecutionBudget: vi.fn(actual.createExecutionBudget) };
});

import * as conversasRepo from "@/server/db/repositories/neo-conversas";
import * as mensagensRepo from "@/server/db/repositories/neo-mensagens";
import * as execucoesRepo from "@/server/db/repositories/neo-execucoes";
import * as etapasRepo from "@/server/db/repositories/neo-etapas";
import * as fontesRepo from "@/server/db/repositories/neo-fontes";
import * as agentMod from "@/server/neo/agent";
import * as budgetMod from "@/server/neo/budget";
import {
  startNeoExecution,
  runNeoExecution,
  resumeNeoExecutionAfterConfirmation,
  cancelNeoExecution,
} from "@/server/neo/orchestrator";
import { registerNeoExecution } from "@/server/neo/execution-registry";
import { NEO_ANSWER_VERSION } from "@/lib/neo/answer";
import { NEO_LIMITS } from "@/server/neo/limits";

function fakeEmitter() {
  const events: NeoEvent[] = [];
  return {
    events,
    emitter: { emit: (e: NeoEvent) => events.push(e), close: () => {}, isClosed: false } as never,
  };
}

function fakeAnswer(overrides: Record<string, unknown> = {}) {
  return {
    version: NEO_ANSWER_VERSION,
    status: "completo" as const,
    titulo: "Relatório",
    objetivo: "",
    indicadoresPrincipais: [],
    achados: [],
    respostaDireta: "Resumo.",
    blocos: [],
    lacunas: [],
    matrizEvidencias: [],
    fontes: [],
    observacoes: [],
    proximasAcoes: [],
    perguntaNecessaria: null,
    ...overrides,
  };
}

function emptyState() {
  return { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 };
}

const execucaoRowBase = {
  id: "exec1",
  conversaId: "conv1",
  mensagemUsuarioId: "msgU1",
  usuarioId: "u1",
  status: "planejando" as const,
  plano: null,
  camposSolicitados: null,
  camposEncontrados: null,
  camposAusentes: null,
  erroPublico: null,
  idempotencyKey: null,
  contextoPendente: null,
  iniciadoEm: "2026-01-01T00:00:00Z",
  concluidoEm: null,
  canceladoEm: null,
  totalFerramentas: 0,
  tokensEntrada: null,
  tokensSaida: null,
  ultimoHeartbeatEm: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mensagensRepo.listarUltimasMensagens).mockResolvedValue([
    { id: "msgA1", conversaId: "conv1", usuarioId: "u1", papel: "assistente", conteudo: null, respostaEstruturada: null, status: "em_execucao", execucaoId: "exec1", criadoEm: "t" },
  ]);
  vi.mocked(mensagensRepo.inserirMensagem).mockResolvedValue({
    id: "msgU1",
    conversaId: "conv1",
    usuarioId: "u1",
    papel: "usuario",
    conteudo: "pergunta",
    respostaEstruturada: null,
    status: "concluida",
    execucaoId: null,
    criadoEm: "t",
  });
  vi.mocked(mensagensRepo.atualizarMensagem).mockResolvedValue(undefined);
  vi.mocked(execucoesRepo.criarExecucao).mockResolvedValue(execucaoRowBase);
  vi.mocked(execucoesRepo.atualizarExecucao).mockResolvedValue(undefined);
  vi.mocked(execucoesRepo.buscarExecucaoPorIdempotencyKey).mockResolvedValue(null);
  vi.mocked(execucoesRepo.buscarExecucaoAtivaPorConversa).mockResolvedValue(null);
  vi.mocked(execucoesRepo.contarExecucoesAtivasPorUsuario).mockResolvedValue(0);
  vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(execucaoRowBase);
  vi.mocked(conversasRepo.buscarConversaPorId).mockResolvedValue({
    id: "conv1",
    usuarioId: "u1",
    titulo: "Conversa",
    resumoContexto: null,
    entidadesAtivas: null,
    status: "ativa",
    criadoEm: "t",
    atualizadoEm: "t",
  });
  vi.mocked(conversasRepo.tocarConversa).mockResolvedValue(undefined);
  vi.mocked(conversasRepo.atualizarConversa).mockResolvedValue(null);
  vi.mocked(etapasRepo.inserirEtapa).mockResolvedValue({
    id: "etapa1",
    execucaoId: "exec1",
    ordem: 1,
    tipo: "confirmacao",
    nomePublico: "Aguardando confirmação",
    ferramentaInterna: "monitor_excluir",
    status: "aguardando",
    argumentosSanitizados: null,
    resultadoResumido: null,
    iniciadoEm: null,
    concluidoEm: null,
    erroPublico: null,
  });
  vi.mocked(etapasRepo.atualizarEtapa).mockResolvedValue(undefined);
  vi.mocked(etapasRepo.listarEtapas).mockResolvedValue([]);
  vi.mocked(fontesRepo.listarFontes).mockResolvedValue([]);
  vi.mocked(fontesRepo.registrarFonte).mockResolvedValue({
    id: "f1",
    execucaoId: "exec1",
    url: "https://a.com",
    titulo: null,
    dominio: null,
    dataObservacao: null,
    metadados: null,
    criadoEm: "t",
  });
  vi.mocked(agentMod.forceNeoAgentConclusion).mockResolvedValue(null);
  vi.mocked(agentMod.createInitialAgentState).mockImplementation(() => ({
    round: 0,
    toolCallsUsed: 0,
    searchCallsUsed: 0,
    evidence: [],
    executedSignatures: [],
    fontes: [],
    tokensEntrada: 0,
    tokensSaida: 0,
  }));
});

describe("startNeoExecution", () => {
  it("returns the existing execution when the idempotency key was already used (double submit)", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorIdempotencyKey).mockResolvedValue(execucaoRowBase);
    const result = await startNeoExecution({ usuarioId: "u1", conversaId: "conv1", mensagemTexto: "oi", idempotencyKey: "k1" });
    expect(result).toMatchObject({ ok: true, alreadyExists: true, execucaoId: "exec1" });
    expect(execucoesRepo.criarExecucao).not.toHaveBeenCalled();
  });

  it("rejects when the user already has the maximum number of concurrent executions", async () => {
    vi.mocked(execucoesRepo.contarExecucoesAtivasPorUsuario).mockResolvedValue(2);
    const result = await startNeoExecution({ usuarioId: "u1", conversaId: "conv1", mensagemTexto: "oi" });
    expect(result.ok).toBe(false);
  });

  it("rejects when the conversation already has an active execution", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoAtivaPorConversa).mockResolvedValue(execucaoRowBase);
    const result = await startNeoExecution({ usuarioId: "u1", conversaId: "conv1", mensagemTexto: "oi" });
    expect(result.ok).toBe(false);
  });

  it("creates the user message, the execution row and an assistant placeholder on success", async () => {
    const result = await startNeoExecution({ usuarioId: "u1", conversaId: "conv1", mensagemTexto: "oi" });
    expect(result).toMatchObject({ ok: true, alreadyExists: false });
    expect(mensagensRepo.inserirMensagem).toHaveBeenCalledWith(expect.objectContaining({ papel: "usuario" }));
    expect(mensagensRepo.inserirMensagem).toHaveBeenCalledWith(expect.objectContaining({ papel: "assistente", status: "em_execucao" }));
    expect(execucoesRepo.criarExecucao).toHaveBeenCalled();
  });
});

describe("runNeoExecution — decisão 'relatorio' direta (sem chamar nenhuma ferramenta)", () => {
  it("emits execucao.iniciada then resposta.concluida, marking the execution concluída — no separate planning event", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } },
      state: emptyState(),
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta simples",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "resposta.concluida"]);
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "concluida" }));
  });
});

describe("runNeoExecution — decisão 'resposta' conversacional (sem relatório)", () => {
  it("emits resposta.mensagem, never resposta.concluida, and persists no respostaEstruturada", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "resposta", texto: "Até agora encontrei o CNPJ e o Instagram oficial." } },
      state: emptyState(),
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "o que você encontrou até agora?",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "resposta.mensagem"]);
    const resposta = events.find((e) => e.tipo === "resposta.mensagem");
    expect(resposta && "texto" in resposta ? resposta.texto : null).toContain("CNPJ");
    expect(mensagensRepo.atualizarMensagem).toHaveBeenCalledWith(
      "msgA1",
      expect.objectContaining({ status: "concluida", respostaEstruturada: null }),
    );
  });
});

describe("runNeoExecution — decisão 'pergunta' (ambiguidade)", () => {
  it("also renders as a plain conversational message — never wrapped in the full relatório schema", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "pergunta", texto: "Você está falando do domínio ou da empresa de Maceió?" } },
      state: emptyState(),
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "procure informações sobre a Carango",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "resposta.mensagem"]);
  });
});

describe("runNeoExecution — decisão 'formulario' (esclarecimento estruturado)", () => {
  it("pauses the execution instead of finishing it, and never emits resposta.concluida", async () => {
    const formulario = {
      titulo: "Configurar monitoramento",
      explicacao: "Preciso da URL e da frequência.",
      campos: [{ id: "url", rotulo: "URL", descricao: null, tipo: "url" as const, obrigatorio: true, valorSugerido: null, opcoes: [] }],
      acaoConfirmacao: "Iniciar monitoramento",
    };
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "formulario", formulario } },
      state: emptyState(),
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "acompanhe este site e me avise quando mudar",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "formulario.necessario"]);
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith(
      "exec1",
      expect.objectContaining({ status: "aguardando_confirmacao", contextoPendente: expect.objectContaining({ formulario }) }),
    );
    expect(mensagensRepo.atualizarMensagem).not.toHaveBeenCalled();
  });
});

describe("runNeoExecution — persistência incremental (total_ferramentas, fontes, heartbeat)", () => {
  it("updates total_ferramentas and registers sources as soon as each step completes, not only at the end", async () => {
    vi.mocked(agentMod.runNeoAgent).mockImplementation(async (_input, callbacks) => {
      const etapaId = await callbacks.onEtapaIniciada({ nomePublico: "Pesquisando na web", ferramentaInterna: "pesquisar_web", argumentos: { q: "x" } });
      await callbacks.onEtapaConcluida(etapaId, { resumo: { resultados: [1] }, fontes: [{ url: "https://a.com", titulo: "A" }], parcial: false });
      return { outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } }, state: emptyState() };
    });
    const { emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta",
      emitter,
      signal: new AbortController().signal,
    });

    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ totalFerramentas: 1 }));
    expect(fontesRepo.registrarFonte).toHaveBeenCalledWith(expect.objectContaining({ execucaoId: "exec1", url: "https://a.com", titulo: "A" }));
  });

  it("sends a heartbeat (DB write + SSE event) on an interval while the execution is running", async () => {
    vi.useFakeTimers();
    try {
      const resolver: { resolve: (() => void) | undefined } = { resolve: undefined };
      vi.mocked(agentMod.runNeoAgent).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolver.resolve = () =>
              resolve({ outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } }, state: emptyState() });
          }),
      );
      const { events, emitter } = fakeEmitter();
      const runPromise = runNeoExecution({
        execucaoId: "exec1",
        mensagemUsuarioId: "msgU1",
        conversaId: "conv1",
        usuarioId: "u1",
        mensagemTexto: "pergunta",
        emitter,
        signal: new AbortController().signal,
      });

      await vi.advanceTimersByTimeAsync(NEO_LIMITS.heartbeatIntervalMs * 2 + 100);
      expect(events.some((e) => e.tipo === "heartbeat")).toBe(true);
      expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ ultimoHeartbeatEm: expect.any(String) }));

      resolver.resolve?.();
      await runPromise;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("runNeoExecution — ação persistente aguardando confirmação", () => {
  it("pauses, persists the pending call, and never persists a relatório", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: {
        status: "aguardando_confirmacao",
        pendentes: [{ callId: "c1", name: "monitor_excluir", args: { monitoramentoId: "m1" } }],
        descricao: "Excluir o monitoramento m1.",
        ferramentaInterna: "monitor_excluir",
      },
      state: emptyState(),
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "exclua o monitoramento m1",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "confirmacao.necessaria"]);
    expect(mensagensRepo.atualizarMensagem).not.toHaveBeenCalled();
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith(
      "exec1",
      expect.objectContaining({ status: "aguardando_confirmacao", contextoPendente: expect.anything() }),
    );
  });
});

describe("runNeoExecution — cancelamento", () => {
  it("with a concrete extracted fact already gathered: still produces a partial report instead of losing the work", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "cancelada" },
      state: {
        ...emptyState(),
        evidence: [
          { ferramenta: "extrair_dados", nomePublico: "Extraindo informações", argumentos: { url: "https://a.com" }, ok: true, resumo: { json: { cnpj: "12.345.678/0001-99" } } },
        ],
      },
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toContain("resposta.concluida");
    expect(events.map((e) => e.tipo)).toContain("execucao.cancelada");
    const resposta = events.find((e) => e.tipo === "resposta.concluida");
    expect(resposta && "resposta" in resposta ? resposta.resposta.status : null).toBe("parcial");
    expect(resposta && "resposta" in resposta ? JSON.stringify(resposta.resposta.achados) : "").toContain("12.345.678/0001-99");
  });

  it("without any evidence: marks the execution cancelada and never fabricates a report", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({ outcome: { status: "cancelada" }, state: emptyState() });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "execucao.cancelada"]);
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "cancelada" }));
  });
});

describe("runNeoExecution — limite atingido", () => {
  it("emits execucao.parcial, then tries one forced conclusion call before finishing", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "limite_atingido", motivo: "O número máximo de rodadas desta análise foi atingido." },
      state: emptyState(),
    });
    vi.mocked(agentMod.forceNeoAgentConclusion).mockResolvedValue({ tipo: "relatorio", relatorio: fakeAnswer({ status: "completo" }) });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "execucao.parcial", "resposta.concluida"]);
    expect(agentMod.forceNeoAgentConclusion).toHaveBeenCalled();
    // A forced conclusion is always downgraded to parcial, even if the model itself said "completo" —
    // reaching the time limit at all is evidence the answer isn't the same as reaching it naturally.
    const resposta = events.find((e) => e.tipo === "resposta.concluida");
    expect(resposta && "resposta" in resposta ? resposta.resposta.status : null).toBe("parcial");
  });

  it("falls back to the deterministic evidence-based report when the forced conclusion call also fails", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "limite_atingido", motivo: "O tempo disponível para esta análise se esgotou." },
      state: {
        ...emptyState(),
        evidence: [
          { ferramenta: "pesquisar_web", nomePublico: "Pesquisando na web", argumentos: { q: "x" }, ok: true, resumo: { resultados: [{ url: "https://a.com" }] } },
          { ferramenta: "extrair_dados", nomePublico: "Extraindo informações", argumentos: { url: "https://a.com" }, ok: true, resumo: { json: { cnpj: "12.345.678/0001-99" } } },
        ],
      },
    });
    vi.mocked(agentMod.forceNeoAgentConclusion).mockResolvedValue(null);
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta",
      emitter,
      signal: new AbortController().signal,
    });
    const resposta = events.find((e) => e.tipo === "resposta.concluida");
    const answer = resposta && "resposta" in resposta ? resposta.resposta : null;
    expect(answer?.status).toBe("parcial");
    expect(JSON.stringify(answer?.achados)).toContain("12.345.678/0001-99");
    expect(JSON.stringify(answer?.achados)).not.toContain("Pesquisando na web");
  });

  it("never attempts a forced conclusion call when the synthesis reserve is already exhausted", async () => {
    const exhaustedBudget = {
      startedAt: Date.now(),
      totalBudgetMs: 240_000,
      synthesisReserveMs: 45_000,
      elapsedMs: () => 285_000,
      toolsRemainingMs: () => 0,
      synthesisRemainingMs: () => 0,
      hasRoundBudget: () => false,
      isExhausted: () => true,
      hardDeadlineMs: () => 285_000,
    };
    vi.mocked(budgetMod.createExecutionBudget).mockReturnValueOnce(exhaustedBudget);
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "limite_atingido", motivo: "O tempo disponível para esta análise se esgotou." },
      state: {
        ...emptyState(),
        evidence: [{ ferramenta: "pesquisar_web", nomePublico: "Pesquisando na web", argumentos: { q: "x" }, ok: true, resumo: { resultados: [{ url: "https://a.com" }] } }],
      },
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta",
      emitter,
      signal: new AbortController().signal,
    });
    expect(agentMod.forceNeoAgentConclusion).not.toHaveBeenCalled();
    const resposta = events.find((e) => e.tipo === "resposta.concluida");
    // Only a plain search ran (no extraction) — never enough for a "parcial" report on its own;
    // it must render as "nao_concluido", not a fabricated report built from step metadata.
    expect(resposta && "resposta" in resposta ? resposta.resposta.status : null).toBe("nao_concluido");
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "parcial" }));
  });
});

describe("runNeoExecution — falha", () => {
  it("marks the execution and message as falhou", async () => {
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "falhou", erroPublico: "Não foi possível iniciar a análise." },
      state: emptyState(),
    });
    const { events, emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "pergunta",
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "execucao.falhou"]);
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "falhou" }));
  });
});

describe("runNeoExecution — continuação de conversa", () => {
  it("passes the conversation's rolling summary through to the agent", async () => {
    vi.mocked(conversasRepo.buscarConversaPorId).mockResolvedValue({
      id: "conv1",
      usuarioId: "u1",
      titulo: "Conversa",
      resumoContexto: "Resumo anterior sobre o alvo.",
      entidadesAtivas: null,
      status: "ativa",
      criadoEm: "t",
      atualizadoEm: "t",
    });
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } },
      state: emptyState(),
    });
    const { emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "continue a análise",
      emitter,
      signal: new AbortController().signal,
    });
    expect(agentMod.runNeoAgent).toHaveBeenCalledWith(
      expect.objectContaining({ resumoContexto: "Resumo anterior sobre o alvo." }),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe("runNeoExecution — continuar análise (seed a partir de execução anterior)", () => {
  it("seeds resumeState from the previous falhou/parcial execution's completed steps and sources, deduping them so the model doesn't re-pay for the same query", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockImplementation(async (_usuarioId: string, id: string) =>
      id === "exec-anterior" ? { ...execucaoRowBase, id: "exec-anterior", status: "parcial" } : execucaoRowBase,
    );
    vi.mocked(etapasRepo.listarEtapas).mockResolvedValue([
      {
        id: "etapa-anterior",
        execucaoId: "exec-anterior",
        ordem: 1,
        tipo: "ferramenta",
        nomePublico: "Pesquisando na web",
        ferramentaInterna: "pesquisar_web",
        status: "concluida",
        argumentosSanitizados: { q: "empresa x" },
        resultadoResumido: { resultados: [{ url: "https://a.com" }] },
        iniciadoEm: "t",
        concluidoEm: "t",
        erroPublico: null,
      },
    ]);
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } },
      state: emptyState(),
    });
    const { emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "continue",
      emitter,
      signal: new AbortController().signal,
      continuarExecucaoId: "exec-anterior",
    });
    const options = vi.mocked(agentMod.runNeoAgent).mock.calls[0]![2];
    expect(options.resumeState?.evidence).toEqual([expect.objectContaining({ ferramenta: "pesquisar_web", ok: true })]);
    expect(options.resumeState?.executedSignatures).toHaveLength(1);
    // Fresh round/tool-call counters — this is a brand-new execution with its own full budget,
    // only the *content* carries over, never the exhausted limits from the previous attempt.
    expect(options.resumeState?.round).toBe(0);
    expect(options.resumeState?.toolCallsUsed).toBe(0);
  });

  it("ignores continuarExecucaoId pointing at an execution that isn't falhou/parcial (still active, or belongs to another conversation)", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockImplementation(async (_usuarioId: string, id: string) =>
      id === "exec-ativa" ? { ...execucaoRowBase, id: "exec-ativa", status: "executando" } : execucaoRowBase,
    );
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } },
      state: emptyState(),
    });
    const { emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "continue",
      emitter,
      signal: new AbortController().signal,
      continuarExecucaoId: "exec-ativa",
    });
    const options = vi.mocked(agentMod.runNeoAgent).mock.calls[0]![2];
    expect(options.resumeState).toBeUndefined();
  });
});

describe("resumeNeoExecutionAfterConfirmation", () => {
  const pendingExecucao = {
    ...execucaoRowBase,
    status: "aguardando_confirmacao" as const,
    contextoPendente: {
      state: emptyState(),
      pendentes: [{ callId: "c1", name: "monitor_excluir", args: { monitoramentoId: "m1" } }],
      mensagemId: "msgA1",
    },
  };

  it("confirmação aprovada: resumes with resumeConfirmedCalls set to the saved pending calls", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(pendingExecucao);
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } },
      state: emptyState(),
    });
    const { emitter } = fakeEmitter();
    await resumeNeoExecutionAfterConfirmation({
      usuarioId: "u1",
      conversaId: "conv1",
      execucaoId: "exec1",
      confirmado: true,
      emitter,
      signal: new AbortController().signal,
    });
    expect(agentMod.runNeoAgent).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: expect.any(String) }),
      expect.anything(),
      expect.objectContaining({ resumeConfirmedCalls: pendingExecucao.contextoPendente.pendentes }),
    );
  });

  it("confirmação recusada: never executes the pending call, records it as declined evidence instead", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(pendingExecucao);
    vi.mocked(agentMod.runNeoAgent).mockResolvedValue({
      outcome: { status: "concluido", decisao: { tipo: "relatorio", relatorio: fakeAnswer() } },
      state: emptyState(),
    });
    const { emitter } = fakeEmitter();
    await resumeNeoExecutionAfterConfirmation({
      usuarioId: "u1",
      conversaId: "conv1",
      execucaoId: "exec1",
      confirmado: false,
      emitter,
      signal: new AbortController().signal,
    });
    const call = vi.mocked(agentMod.runNeoAgent).mock.calls[0]!;
    expect(call[2].resumeConfirmedCalls).toBeUndefined();
    expect(call[2].resumeState?.evidence).toEqual([
      expect.objectContaining({ ferramenta: "monitor_excluir", ok: false, erroPublico: "Ação não confirmada pelo usuário." }),
    ]);
  });

  it("reports a handled error when there is no pending confirmation for this execution", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue({ ...execucaoRowBase, status: "concluida" });
    const { events, emitter } = fakeEmitter();
    await resumeNeoExecutionAfterConfirmation({
      usuarioId: "u1",
      conversaId: "conv1",
      execucaoId: "exec1",
      confirmado: true,
      emitter,
      signal: new AbortController().signal,
    });
    expect(events.map((e) => e.tipo)).toEqual(["execucao.falhou"]);
    expect(agentMod.runNeoAgent).not.toHaveBeenCalled();
  });
});

describe("cancelNeoExecution", () => {
  it("returns not_found for a nonexistent or foreign execution", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(null);
    const result = await cancelNeoExecution("u1", "exec1");
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ type: "not_found" }) });
  });

  it("reports jaFinalizada without side effects when the execution already ended", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue({ ...execucaoRowBase, status: "concluida" });
    const result = await cancelNeoExecution("u1", "exec1");
    expect(result).toEqual({ ok: true, jaFinalizada: true });
    expect(execucoesRepo.atualizarExecucao).not.toHaveBeenCalled();
  });

  it("aborts the same-instance controller when one is registered, without a redundant DB write", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(execucaoRowBase);
    const controller = new AbortController();
    registerNeoExecution("exec1", controller);
    const result = await cancelNeoExecution("u1", "exec1");
    expect(result).toEqual({ ok: true, jaFinalizada: false });
    expect(controller.signal.aborted).toBe(true);
    expect(execucoesRepo.atualizarExecucao).not.toHaveBeenCalled();
  });

  it("falls back to a direct DB update when no controller is registered for this instance", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue({ ...execucaoRowBase, id: "exec-no-controller" });
    const result = await cancelNeoExecution("u1", "exec-no-controller");
    expect(result).toEqual({ ok: true, jaFinalizada: false });
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec-no-controller", expect.objectContaining({ status: "cancelada" }));
  });
});
