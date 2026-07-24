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

import * as conversasRepo from "@/server/db/repositories/neo-conversas";
import * as mensagensRepo from "@/server/db/repositories/neo-mensagens";
import * as execucoesRepo from "@/server/db/repositories/neo-execucoes";
import * as etapasRepo from "@/server/db/repositories/neo-etapas";
import * as fontesRepo from "@/server/db/repositories/neo-fontes";
import * as plannerMod from "@/server/neo/planner";
import * as executorMod from "@/server/neo/executor";
import * as synthesizerMod from "@/server/neo/synthesizer";
import {
  startNeoExecution,
  runNeoExecution,
  resumeNeoExecutionAfterConfirmation,
  cancelNeoExecution,
} from "@/server/neo/orchestrator";
import { registerNeoExecution } from "@/server/neo/execution-registry";
import { NEO_ANSWER_VERSION } from "@/lib/neo/answer";

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
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mensagensRepo.listarUltimasMensagens).mockResolvedValue([
    { id: "msgA1", conversaId: "conv1", usuarioId: "u1", papel: "assistente", conteudo: null, respostaEstruturada: null, status: "em_execucao", criadoEm: "t" },
  ]);
  vi.mocked(mensagensRepo.inserirMensagem).mockResolvedValue({
    id: "msgU1",
    conversaId: "conv1",
    usuarioId: "u1",
    papel: "usuario",
    conteudo: "pergunta",
    respostaEstruturada: null,
    status: "concluida",
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

describe("runNeoExecution — resposta direta sem ferramenta", () => {
  it("emits execucao.iniciada, plano.pronto and resposta.concluida, marking the execution concluída", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
      state: { round: 1, toolCallsUsed: 1, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
        toolCallsUsed: 1,
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
      state: { round: 1, toolCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
      state: { round: 10, toolCallsUsed: 20, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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

describe("runNeoExecution — falha", () => {
  it("marks the execution and message as falhou and never calls the synthesizer", async () => {
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "falhou", erroPublico: "Não foi possível iniciar a investigação." },
      state: { round: 1, toolCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
      state: { round: 1, toolCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
      state: { round: 1, toolCallsUsed: 0, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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

describe("resumeNeoExecutionAfterConfirmation", () => {
  const pendingExecucao = {
    ...execucaoRowBase,
    status: "aguardando_confirmacao" as const,
    contextoPendente: {
      state: { round: 1, toolCallsUsed: 1, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
      pendentes: [{ callId: "c1", name: "monitor_excluir", args: { monitoramentoId: "m1" } }],
      plan,
      mensagemId: "msgA1",
    },
  };

  it("confirmação aprovada: resumes with resumeConfirmedCalls set to the saved pending calls", async () => {
    vi.mocked(execucoesRepo.buscarExecucaoPorId).mockResolvedValue(pendingExecucao);
    vi.mocked(executorMod.runExecutor).mockResolvedValue({
      outcome: { status: "sem_ferramentas" },
      state: { round: 1, toolCallsUsed: 1, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
      state: { round: 1, toolCallsUsed: 1, evidence: [], executedSignatures: [], fontes: [], tokensEntrada: 0, tokensSaida: 0 },
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
