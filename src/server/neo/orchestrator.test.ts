import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NeoEvent } from "@/lib/neo/events";

vi.mock("@/server/neo/tools", () => ({}));
vi.mock("@/server/db/repositories/neo-conversas");
vi.mock("@/server/db/repositories/neo-mensagens");
vi.mock("@/server/db/repositories/neo-execucoes");
vi.mock("@/server/db/repositories/neo-etapas");
vi.mock("@/server/db/repositories/neo-fontes");
vi.mock("@/server/neo/planner");
vi.mock("@/server/neo/executor");
vi.mock("@/server/neo/synthesizer");
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
import * as plannerMod from "@/server/neo/planner";
import * as executorMod from "@/server/neo/executor";
import * as synthesizerMod from "@/server/neo/synthesizer";
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

const plan = {
  objetivoInterpretado: "Investigar um alvo genérico.",
  ambiguidadeBloqueante: false,
  perguntaNecessaria: null,
  etapasPlanejadas: ["Localizar fontes"],
  dadosNecessarios: [],
  criteriosConclusao: ["Ao menos uma fonte"],
  ferramentasProvaveis: [],
  execucaoParalelaPossivel: true,
  riscoConfusaoEntidades: null,
  camposSolicitados: ["site oficial"],
  formatoRelatorioEsperado: "texto",
};

function fakeAnswer(overrides: Record<string, unknown> = {}) {
  return {
    version: NEO_ANSWER_VERSION,
    status: "completo" as const,
    titulo: "Relatório",
    resumoExecutivo: "Resumo.",
    blocos: [],
    fontes: [],
    informacoesAusentes: [],
    observacoes: [],
    proximasAcoes: [],
    perguntaNecessaria: null,
    ...overrides,
  };
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
  vi.mocked(plannerMod.planInvestigation).mockResolvedValue({ ok: true, plan });
  vi.mocked(synthesizerMod.synthesizeAnswer).mockResolvedValue({
    answer: fakeAnswer(),
    fontes: [],
    tokensEntrada: 1,
    tokensSaida: 1,
    validationFailed: false,
  });
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

describe("runNeoExecution — entidade ambígua / pergunta bloqueante", () => {
  it("skips the executor entirely and asks the blocking question through the answer schema", async () => {
    vi.mocked(plannerMod.planInvestigation).mockResolvedValue({
      ok: true,
      plan: { ...plan, ambiguidadeBloqueante: true, perguntaNecessaria: "Qual empresa, exatamente?" },
    });
    const { events } = fakeEmitter();
    const { emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "investigue uma empresa",
      emitter,
      signal: new AbortController().signal,
    });
    expect(executorMod.runExecutor).not.toHaveBeenCalled();
    expect(synthesizerMod.synthesizeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ perguntaBloqueante: "Qual empresa, exatamente?" }),
      expect.anything(),
    );
    void events;
  });
});

describe("runNeoExecution — persistência incremental (total_ferramentas, fontes, heartbeat)", () => {
  it("updates total_ferramentas and registers sources as soon as each step completes, not only at the end", async () => {
    vi.mocked(executorMod.runExecutor).mockImplementation(async (_plan, _msg, callbacks) => {
      const etapaId = await callbacks.onEtapaIniciada({ nomePublico: "Pesquisando na web", ferramentaInterna: "pesquisar_web", argumentos: { q: "x" } });
      await callbacks.onEtapaConcluida(etapaId, { resumo: { resultados: [1] }, fontes: [{ url: "https://a.com", titulo: "A" }], parcial: false });
      return {
        outcome: { status: "sem_ferramentas" },
        state: { round: 1, toolCallsUsed: 1, searchCallsUsed: 1, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
      };
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

    // total_ferramentas is updated the moment the step finishes, before the execution as a whole ends.
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ totalFerramentas: 1 }));
    // The source is persisted right away too, not deferred until finishWithAnswer.
    expect(fontesRepo.registrarFonte).toHaveBeenCalledWith(expect.objectContaining({ execucaoId: "exec1", url: "https://a.com", titulo: "A" }));
  });

  it("sends a heartbeat (DB write + SSE event) on an interval while the execution is running", async () => {
    vi.useFakeTimers();
    try {
      const resolver: { resolve: (() => void) | undefined } = { resolve: undefined };
      vi.mocked(executorMod.runExecutor).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolver.resolve = () =>
              resolve({
                outcome: { status: "sem_ferramentas" },
                state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
              });
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

describe("runNeoExecution — resposta direta sem ferramenta", () => {
  it("emits execucao.iniciada, plano.pronto and resposta.concluida, marking the execution concluída", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "plano.pronto", "resposta.concluida"]);
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "concluida" }));
  });
});

describe("runNeoExecution — ação persistente aguardando confirmação", () => {
  it("pauses, persists the pending call, and never calls the synthesizer", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: {
        status: "aguardando_confirmacao",
        pendentes: [{ callId: "c1", name: "monitor_excluir", args: { monitoramentoId: "m1" } }],
        descricao: "Excluir o monitoramento m1.",
        ferramentaInterna: "monitor_excluir",
      },
      state: { round: 1, toolCallsUsed: 1, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "plano.pronto", "confirmacao.necessaria"]);
    expect(synthesizerMod.synthesizeAnswer).not.toHaveBeenCalled();
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith(
      "exec1",
      expect.objectContaining({ status: "aguardando_confirmacao", contextoPendente: expect.anything() }),
    );
  });
});

describe("runNeoExecution — cancelamento", () => {
  it("with evidence already gathered: still produces a partial answer instead of losing the work", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "cancelada" },
      state: {
        round: 1,
        toolCallsUsed: 1, searchCallsUsed: 0,
        evidence: [{ ferramenta: "pesquisar_web", nomePublico: "Pesquisando", argumentos: {}, ok: true, resumo: {} }],
        executedSignatures: [],
        fontes: [],
        tokensEntrada: 0,
        tokensSaida: 0,
      },
    });
    vi.mocked(synthesizerMod.synthesizeAnswer).mockResolvedValue({
      answer: fakeAnswer({ status: "completo" }),
      fontes: [],
      tokensEntrada: 1,
      tokensSaida: 1,
      validationFailed: false,
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
  });

  it("without any evidence: never calls the synthesizer and marks the execution cancelada", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "cancelada" },
      state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    expect(synthesizerMod.synthesizeAnswer).not.toHaveBeenCalled();
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "plano.pronto", "execucao.cancelada"]);
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "cancelada" }));
  });
});

describe("runNeoExecution — limite atingido", () => {
  it("emits execucao.parcial before the final answer and still produces a report", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "limite_atingido", motivo: "Número máximo de rodadas atingido." },
      state: { round: 10, toolCallsUsed: 20, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "plano.pronto", "execucao.parcial", "resposta.concluida"]);
    expect(synthesizerMod.synthesizeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ limiteAtingidoMotivo: "Número máximo de rodadas atingido." }),
      expect.anything(),
    );
  });
});

describe("runNeoExecution — falha na síntese com relatório parcial de evidências", () => {
  it("overrides the synthesizer's generic text-only fallback with the evidence-based report when there's usable evidence", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: {
        round: 1,
        toolCallsUsed: 1,
        searchCallsUsed: 1,
        evidence: [{ ferramenta: "pesquisar_web", nomePublico: "Pesquisando na web", argumentos: { q: "x" }, ok: true, resumo: { resultados: [{ url: "https://a.com" }] } }],
        executedSignatures: [],
        fontes: [{ url: "https://a.com" }],
        tokensEntrada: 0,
        tokensSaida: 0,
      },
    });
    vi.mocked(synthesizerMod.synthesizeAnswer).mockResolvedValue({
      answer: fakeAnswer({ titulo: "Resposta do Neo", blocos: [{ tipo: "texto", titulo: null, conteudo: "genérico", fontesIds: [] }] }),
      fontes: [],
      tokensEntrada: 1,
      tokensSaida: 1,
      validationFailed: true,
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
    const resposta = events.find((e) => e.tipo === "resposta.concluida");
    const answer = resposta && "resposta" in resposta ? resposta.resposta : null;
    // Not the synthesizer's generic "Resposta do Neo" fallback — the deterministic
    // evidence-based one, which actually names the completed step.
    expect(answer?.titulo).not.toBe("Resposta do Neo");
    expect(JSON.stringify(answer?.blocos)).toContain("Pesquisando na web");
    expect(answer?.status).toBe("parcial");
  });
});

describe("runNeoExecution — falha", () => {
  it("marks the execution and message as falhou and never calls the synthesizer", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "falhou", erroPublico: "Não foi possível iniciar a investigação." },
      state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    expect(synthesizerMod.synthesizeAnswer).not.toHaveBeenCalled();
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "plano.pronto", "execucao.falhou"]);
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "falhou" }));
  });

  it("when the planner itself fails, never calls the executor", async () => {
    vi.mocked(plannerMod.planInvestigation).mockResolvedValue({ ok: false, error: { type: "provider_error", message: "erro", httpStatus: 502 } });
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
    expect(executorMod.runExecutor).not.toHaveBeenCalled();
    expect(events.map((e) => e.tipo)).toEqual(["execucao.iniciada", "execucao.falhou"]);
  });
});

describe("runNeoExecution — continuação de conversa", () => {
  it("passes the conversation's rolling summary through to the planner", async () => {
    vi.mocked(conversasRepo.buscarConversaPorId).mockResolvedValue({
      id: "conv1",
      usuarioId: "u1",
      titulo: "Conversa",
      resumoContexto: "Resumo anterior sobre o alvo.",
      status: "ativa",
      criadoEm: "t",
      atualizadoEm: "t",
    });
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
    });
    const { emitter } = fakeEmitter();
    await runNeoExecution({
      execucaoId: "exec1",
      mensagemUsuarioId: "msgU1",
      conversaId: "conv1",
      usuarioId: "u1",
      mensagemTexto: "continue a investigação",
      emitter,
      signal: new AbortController().signal,
    });
    expect(plannerMod.planInvestigation).toHaveBeenCalledWith(
      expect.objectContaining({ resumoContexto: "Resumo anterior sobre o alvo." }),
      expect.anything(),
    );
  });
});

describe("runNeoExecution — informação ausente (campos encontrados/ausentes)", () => {
  it("computes camposEncontrados as camposSolicitados minus informacoesAusentes", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
    });
    vi.mocked(synthesizerMod.synthesizeAnswer).mockResolvedValue({
      answer: fakeAnswer({ informacoesAusentes: ["telefone"] }),
      fontes: [],
      tokensEntrada: 1,
      tokensSaida: 1,
      validationFailed: false,
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
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith(
      "exec1",
      expect.objectContaining({ camposEncontrados: ["site oficial"], camposAusentes: ["telefone"] }),
    );
  });
});

describe("runNeoExecution — continuar investigação (seed a partir de execução anterior)", () => {
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
    vi.mocked(fontesRepo.listarFontes).mockResolvedValue([
      { id: "f1", execucaoId: "exec-anterior", url: "https://a.com", titulo: "A", dominio: "a.com", dataObservacao: "t", metadados: null, criadoEm: "t" },
    ]);
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    const options = vi.mocked(executorMod.runExecutor).mock.calls[0]![3];
    expect(options.resumeState?.evidence).toEqual([expect.objectContaining({ ferramenta: "pesquisar_web", ok: true })]);
    expect(options.resumeState?.executedSignatures).toHaveLength(1);
    expect(options.resumeState?.fontes).toEqual([expect.objectContaining({ url: "https://a.com" })]);
    // Fresh round/tool-call counters — this is a brand-new execution with its own full budget,
    // only the *content* carries over, never the exhausted limits from the previous attempt.
    expect(options.resumeState?.round).toBe(0);
    expect(options.resumeState?.toolCallsUsed).toBe(0);
  });

  it("ignores continuarExecucaoId pointing at an execution that isn't falhou/parcial (still active, or belongs to another conversation)", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockImplementation(async (_usuarioId: string, id: string) =>
      id === "exec-ativa" ? { ...execucaoRowBase, id: "exec-ativa", status: "executando" } : execucaoRowBase,
    );
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 0, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    const options = vi.mocked(executorMod.runExecutor).mock.calls[0]![3];
    expect(options.resumeState).toBeUndefined();
  });
});

describe("runNeoExecution — orçamento esgotado (fallback determinístico sem chamada à LLM)", () => {
  it("builds the deterministic evidence-based report and never calls the synthesizer when there's no time left in the synthesis reserve", async () => {
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
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "limite_atingido", motivo: "O tempo disponível para esta investigação se esgotou." },
      state: {
        round: 4,
        toolCallsUsed: 3,
        searchCallsUsed: 3,
        evidence: [{ ferramenta: "pesquisar_web", nomePublico: "Pesquisando na web", argumentos: { q: "x" }, ok: true, resumo: { resultados: [{ url: "https://a.com" }] } }],
        executedSignatures: [],
        fontes: [{ url: "https://a.com" }],
        tokensEntrada: 0,
        tokensSaida: 0,
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
    expect(synthesizerMod.synthesizeAnswer).not.toHaveBeenCalled();
    const resposta = events.find((e) => e.tipo === "resposta.concluida");
    expect(resposta && "resposta" in resposta ? resposta.resposta.status : null).toBe("parcial");
    expect(resposta && "resposta" in resposta ? JSON.stringify(resposta.resposta.blocos) : "").toContain("Pesquisando na web");
    expect(execucoesRepo.atualizarExecucao).toHaveBeenCalledWith("exec1", expect.objectContaining({ status: "parcial" }));
  });
});

describe("resumeNeoExecutionAfterConfirmation", () => {
  const pendingExecucao = {
    ...execucaoRowBase,
    status: "aguardando_confirmacao" as const,
    contextoPendente: {
      state: { round: 1, toolCallsUsed: 1, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
      pendentes: [{ callId: "c1", name: "monitor_excluir", args: { monitoramentoId: "m1" } }],
      plan,
      mensagemId: "msgA1",
    },
  };

  it("confirmação aprovada: resumes with resumeConfirmedCalls set to the saved pending calls", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(pendingExecucao);
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 1, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    expect(executorMod.runExecutor).toHaveBeenCalledWith(
      plan,
      expect.any(String),
      expect.anything(),
      expect.objectContaining({ resumeConfirmedCalls: pendingExecucao.contextoPendente.pendentes }),
    );
  });

  it("confirmação recusada: never executes the pending call, records it as declined evidence instead", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(pendingExecucao);
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 1, searchCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
    const call = vi.mocked(executorMod.runExecutor).mock.calls[0]!;
    expect(call[3].resumeConfirmedCalls).toBeUndefined();
    expect(call[3].resumeState?.evidence).toEqual([
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
    expect(executorMod.runExecutor).not.toHaveBeenCalled();
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
