import "server-only";
import "@/server/neo/tools";
import { NEO_LIMITS } from "@/server/neo/limits";
import { createExecutionBudget, type ExecutionBudget } from "@/server/neo/budget";
import { planInvestigation, type PlannerMessage } from "@/server/neo/planner";
import {
  runExecutor,
  type EtapaConcluidaInfo,
  type EvidenceEntry,
  type ExecutorState,
  type PendingCall,
} from "@/server/neo/executor";
import { synthesizeAnswer } from "@/server/neo/synthesizer";
import { buildEvidenceFallbackAnswer, hasFallbackEvidence, summarizeToolResult, type FallbackEtapaLike } from "@/server/neo/fallback-answer";
import { NeoEventEmitter } from "@/server/neo/events";
import { registerNeoExecution, requestNeoExecutionCancellation, unregisterNeoExecution } from "@/server/neo/execution-registry";
import { reconcileConversationExecution } from "@/server/neo/reconciliation";
import { logNeoInfo, logNeoWarn } from "@/server/neo/observability";
import { neoError, type NeoError } from "@/server/neo/errors";
import type { NeoPlan } from "@/server/neo/schemas";
import { refreshConversationSummary } from "@/server/neo/memory";
import type { NormalizedFonte } from "@/server/neo/tool-normalizers";

import { atualizarConversa, buscarConversaPorId, tocarConversa } from "@/server/db/repositories/neo-conversas";
import { atualizarMensagem, inserirMensagem, listarUltimasMensagens } from "@/server/db/repositories/neo-mensagens";
import {
  atualizarExecucao,
  buscarExecucaoAtivaPorConversa,
  buscarExecucaoPorId,
  buscarExecucaoPorIdempotencyKey,
  contarExecucoesAtivasPorUsuario,
  criarExecucao,
} from "@/server/db/repositories/neo-execucoes";
import { inserirEtapa, atualizarEtapa, listarEtapas, type NeoEtapaRow } from "@/server/db/repositories/neo-etapas";
import { registrarFonte } from "@/server/db/repositories/neo-fontes";
import { listarFontes } from "@/server/db/repositories/neo-fontes";
import type { NeoAnswer } from "@/lib/neo/answer";

export interface StartExecutionInput {
  usuarioId: string;
  conversaId: string;
  mensagemTexto: string;
  idempotencyKey?: string;
}

export type StartExecutionResult =
  | { ok: true; execucaoId: string; mensagemUsuarioId: string; alreadyExists: boolean }
  | { ok: false; error: NeoError };

/** Pre-flight checks + row creation. Called by the route before opening the SSE stream. */
export async function startNeoExecution(input: StartExecutionInput): Promise<StartExecutionResult> {
  if (input.idempotencyKey) {
    const existing = await buscarExecucaoPorIdempotencyKey(input.conversaId, input.idempotencyKey);
    if (existing) {
      return { ok: true, execucaoId: existing.id, mensagemUsuarioId: existing.mensagemUsuarioId, alreadyExists: true };
    }
  }

  // Self-heal before deciding whether this conversation already has an
  // "active" execution — without this, a single orphaned execution (the
  // process died before reaching a terminal status) would permanently block
  // every future message in the conversation, forever, since
  // buscarExecucaoAtivaPorConversa would keep finding it.
  await reconcileConversationExecution(input.conversaId).catch(() => {});

  const [ativasUsuario, execucaoAtivaConversa] = await Promise.all([
    contarExecucoesAtivasPorUsuario(input.usuarioId),
    buscarExecucaoAtivaPorConversa(input.conversaId),
  ]);

  if (ativasUsuario >= NEO_LIMITS.maxConcurrentExecutionsPerUser) {
    return { ok: false, error: neoError("rate_limit", "Limite temporário atingido. Tente novamente em alguns instantes.") };
  }
  if (execucaoAtivaConversa) {
    return { ok: false, error: neoError("rate_limit", "Já existe uma investigação em andamento nesta conversa.") };
  }

  const mensagemUsuario = await inserirMensagem({
    conversaId: input.conversaId,
    usuarioId: input.usuarioId,
    papel: "usuario",
    conteudo: input.mensagemTexto,
    status: "concluida",
  });

  const execucao = await criarExecucao({
    conversaId: input.conversaId,
    mensagemUsuarioId: mensagemUsuario.id,
    usuarioId: input.usuarioId,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  await inserirMensagem({
    conversaId: input.conversaId,
    usuarioId: input.usuarioId,
    papel: "assistente",
    status: "em_execucao",
    execucaoId: execucao.id,
  });

  return { ok: true, execucaoId: execucao.id, mensagemUsuarioId: mensagemUsuario.id, alreadyExists: false };
}

interface EtapaTracking {
  ordem: number;
  nomePublico: string;
}

function buildExecutorCallbacks(
  execucaoId: string,
  emitter: NeoEventEmitter,
  ordemRef: { current: number },
  totalRef: { current: number },
) {
  const tracking = new Map<string, EtapaTracking>();
  const heartbeat = () => {
    void atualizarExecucao(execucaoId, { ultimoHeartbeatEm: new Date().toISOString() }).catch(() => {});
  };

  return {
    async onEtapaIniciada(info: { nomePublico: string; ferramentaInterna: string; argumentos: unknown }) {
      ordemRef.current += 1;
      const ordem = ordemRef.current;
      const etapa = await inserirEtapa({
        execucaoId,
        ordem,
        tipo: "ferramenta",
        nomePublico: info.nomePublico,
        ferramentaInterna: info.ferramentaInterna,
        status: "em_execucao",
        argumentosSanitizados: info.argumentos,
      });
      tracking.set(etapa.id, { ordem, nomePublico: info.nomePublico });
      heartbeat();
      emitter.emit({ tipo: "etapa.iniciada", etapaId: etapa.id, ordem, nomePublico: info.nomePublico });
      return etapa.id;
    },
    async onEtapaConcluida(etapaId: string, info: EtapaConcluidaInfo) {
      await atualizarEtapa(etapaId, {
        status: info.parcial ? "parcial" : "concluida",
        resultadoResumido: info.resumo,
        concluidoEm: new Date().toISOString(),
      });
      totalRef.current += 1;
      await Promise.all([
        atualizarExecucao(execucaoId, { totalFerramentas: totalRef.current, ultimoHeartbeatEm: new Date().toISOString() }).catch(() => {}),
        ...info.fontes.map((fonte) =>
          registrarFonte({
            execucaoId,
            url: fonte.url,
            titulo: fonte.titulo ?? null,
            dominio: fonte.dominio ?? null,
            dataObservacao: fonte.dataObservacao ?? null,
          }).catch(() => {}),
        ),
      ]);
      const track = tracking.get(etapaId);
      emitter.emit({
        tipo: "etapa.concluida",
        etapaId,
        ordem: track?.ordem ?? 0,
        nomePublico: track?.nomePublico ?? "",
        resumo: summarizeToolResult(info.resumo),
      });
    },
    async onEtapaFalhou(etapaId: string, mensagem: string) {
      await atualizarEtapa(etapaId, { status: "falhou", erroPublico: mensagem, concluidoEm: new Date().toISOString() });
      totalRef.current += 1;
      await atualizarExecucao(execucaoId, { totalFerramentas: totalRef.current, ultimoHeartbeatEm: new Date().toISOString() }).catch(() => {});
      const track = tracking.get(etapaId);
      emitter.emit({ tipo: "etapa.falhou", etapaId, ordem: track?.ordem ?? 0, nomePublico: track?.nomePublico ?? "", mensagem });
    },
  };
}

async function findAssistantPlaceholder(conversaId: string) {
  const mensagens = await listarUltimasMensagens(conversaId, 3);
  return [...mensagens].reverse().find((m) => m.papel === "assistente" && m.status === "em_execucao");
}

async function failExecution(execucaoId: string, mensagemId: string | undefined, mensagem: string) {
  await atualizarExecucao(execucaoId, { status: "falhou", erroPublico: mensagem, concluidoEm: new Date().toISOString() });
  if (mensagemId) await atualizarMensagem(mensagemId, { status: "falhou", conteudo: mensagem });
}

/** Mirrors executor.ts's toolCallSignature — kept local (not imported) so this stays independent of that module's mock surface in tests; both are trivial, stable, and covered by their own tests. */
function continuationSignature(name: string, args: Record<string, unknown>): string {
  const sorted = Object.keys(args)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {});
  return `${name}:${JSON.stringify(sorted)}`;
}

/** Loads a previous falhou/parcial execution's completed steps + sources as a seed state, so `Continuar investigação` never re-pays for work already done. */
async function buildContinuationSeed(usuarioId: string, conversaId: string, continuarExecucaoId: string): Promise<ExecutorState | null> {
  const anterior = await buscarExecucaoPorId(usuarioId, continuarExecucaoId);
  if (!anterior || anterior.conversaId !== conversaId) return null;
  if (anterior.status !== "falhou" && anterior.status !== "parcial") return null;

  const [etapas, fontes] = await Promise.all([listarEtapas(anterior.id), listarFontes(anterior.id).catch(() => [])]);
  const state: ExecutorState = {
    round: 0,
    toolCallsUsed: 0,
    searchCallsUsed: 0,
    evidence: [],
    executedSignatures: [],
    fontes: [],
    tokensEntrada: 0,
    tokensSaida: 0,
  };

  for (const etapa of etapas) {
    if (etapa.tipo !== "ferramenta" || !etapa.ferramentaInterna) continue;
    const resolvida = etapa.status === "concluida" || etapa.status === "parcial";
    if (!resolvida && etapa.status !== "falhou") continue;

    const args = (etapa.argumentosSanitizados ?? {}) as Record<string, unknown>;
    state.evidence.push({
      ferramenta: etapa.ferramentaInterna,
      nomePublico: etapa.nomePublico,
      argumentos: args,
      ok: resolvida,
      resumo: etapa.resultadoResumido,
      erroPublico: etapa.erroPublico ?? undefined,
    });
    // Only a call that actually succeeded is protected from re-execution — a
    // failed one should stay retryable, since it might succeed this time.
    if (resolvida) state.executedSignatures.push(continuationSignature(etapa.ferramentaInterna, args));
  }

  for (const fonte of fontes) {
    state.fontes.push({
      url: fonte.url,
      titulo: fonte.titulo ?? undefined,
      dominio: fonte.dominio ?? undefined,
      dataObservacao: fonte.dataObservacao ?? undefined,
    });
  }

  return state;
}

/** Runs phases 1-4 for a freshly created execution and streams friendly events to the browser. */
export async function runNeoExecution(params: {
  execucaoId: string;
  mensagemUsuarioId: string;
  conversaId: string;
  usuarioId: string;
  mensagemTexto: string;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
  /** When the user chose "Continuar investigação" on a previous falhou/parcial execution — seeds the new run with its completed steps and sources. */
  continuarExecucaoId?: string;
}): Promise<void> {
  const { execucaoId, mensagemUsuarioId, conversaId, usuarioId, mensagemTexto, emitter, signal, continuarExecucaoId } = params;
  const budget = createExecutionBudget();
  const localController = new AbortController();
  const hardTimeoutController = new AbortController();
  const hardTimer = setTimeout(() => hardTimeoutController.abort(), budget.hardDeadlineMs());
  const combinedSignal = AbortSignal.any([signal, localController.signal, hardTimeoutController.signal]);
  registerNeoExecution(execucaoId, localController);

  const heartbeatTimer = setInterval(() => {
    void atualizarExecucao(execucaoId, { ultimoHeartbeatEm: new Date().toISOString() }).catch(() => {});
    emitter.emit({ tipo: "heartbeat", execucaoId, decorridoMs: budget.elapsedMs() });
  }, NEO_LIMITS.heartbeatIntervalMs);

  const assistantMessage = await findAssistantPlaceholder(conversaId);
  logNeoInfo("execucao.iniciada", { execucaoId, fase: "planejando" });

  try {
    await atualizarExecucao(execucaoId, { ultimoHeartbeatEm: new Date().toISOString() }).catch(() => {});
    emitter.emit({ tipo: "execucao.iniciada", execucaoId, mensagemId: mensagemUsuarioId });

    const conversa = await buscarConversaPorId(usuarioId, conversaId);
    const recentes = await listarUltimasMensagens(conversaId, NEO_LIMITS.recentMessagesWindow);
    const plannerMessages: PlannerMessage[] = recentes
      .filter((m) => m.id !== mensagemUsuarioId && m.id !== assistantMessage?.id)
      .filter((m): m is typeof m & { conteudo: string } => Boolean(m.conteudo) && m.papel !== "sistema")
      .map((m) => ({ papel: m.papel === "usuario" ? "usuario" : "assistente", conteudo: m.conteudo }));

    await atualizarExecucao(execucaoId, { status: "planejando" });
    const planResult = await planInvestigation(
      { mensagemAtual: mensagemTexto, resumoContexto: conversa?.resumoContexto ?? null, mensagensRecentes: plannerMessages },
      combinedSignal,
    );

    if (!planResult.ok) {
      await failExecution(execucaoId, assistantMessage?.id, planResult.error.message);
      logNeoWarn("execucao.falhou", { execucaoId, fase: "planejando", motivoFinalizacao: "plano_invalido" });
      emitter.emit({ tipo: "execucao.falhou", mensagem: planResult.error.message });
      return;
    }

    const plan = planResult.plan;
    await atualizarExecucao(execucaoId, { status: "executando", plano: plan, camposSolicitados: plan.camposSolicitados });
    emitter.emit({ tipo: "plano.pronto", objetivo: plan.objetivoInterpretado, etapasPrevistas: plan.etapasPlanejadas });

    if (plan.ambiguidadeBloqueante && plan.perguntaNecessaria) {
      await finishWithAnswer({
        execucaoId,
        mensagemId: assistantMessage?.id,
        conversaId,
        usuarioId,
        emitter,
        signal: combinedSignal,
        budget,
        userMessage: mensagemTexto,
        plan,
        evidence: [],
        fontesColetadas: [],
        perguntaBloqueante: plan.perguntaNecessaria,
        camposSolicitados: plan.camposSolicitados,
        tokensEntradaAcumulado: 0,
        tokensSaidaAcumulado: 0,
      });
      return;
    }

    const seedState = continuarExecucaoId ? await buildContinuationSeed(usuarioId, conversaId, continuarExecucaoId) : null;
    const ordemRef = { current: 0 };
    const totalRef = { current: 0 };
    const outcome = await runExecutor(plan, mensagemTexto, buildExecutorCallbacks(execucaoId, emitter, ordemRef, totalRef), {
      usuarioId,
      signal: combinedSignal,
      budget,
      resumeState: seedState ?? undefined,
    });

    await handleExecutorOutcome({
      execucaoId,
      conversaId,
      usuarioId,
      mensagemId: assistantMessage?.id,
      emitter,
      signal: combinedSignal,
      budget,
      userMessage: mensagemTexto,
      plan,
      state: outcome.state,
      outcome: outcome.outcome,
    });
  } catch {
    const message = signal.aborted ? "A execução foi interrompida." : "Não foi possível concluir a investigação.";
    await failExecution(execucaoId, assistantMessage?.id, message);
    logNeoWarn("execucao.falhou", { execucaoId, motivoFinalizacao: "excecao_nao_tratada" });
    emitter.emit({ tipo: "execucao.falhou", mensagem: message });
  } finally {
    clearTimeout(hardTimer);
    clearInterval(heartbeatTimer);
    unregisterNeoExecution(execucaoId);
    emitter.close();
  }
}

interface HandleOutcomeParams {
  execucaoId: string;
  conversaId: string;
  usuarioId: string;
  mensagemId: string | undefined;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
  budget: ExecutionBudget;
  userMessage: string;
  plan: NeoPlan;
  state: ExecutorState;
  outcome: Awaited<ReturnType<typeof runExecutor>>["outcome"];
}

async function handleExecutorOutcome(params: HandleOutcomeParams): Promise<void> {
  const { execucaoId, conversaId, usuarioId, mensagemId, emitter, signal, budget, userMessage, plan, state, outcome } = params;

  if (outcome.status === "aguardando_confirmacao") {
    const etapa = await inserirEtapa({
      execucaoId,
      ordem: 9999,
      tipo: "confirmacao",
      nomePublico: "Aguardando confirmação",
      ferramentaInterna: outcome.ferramentaInterna,
      status: "aguardando",
      argumentosSanitizados: outcome.pendentes,
    });
    await atualizarExecucao(execucaoId, {
      status: "aguardando_confirmacao",
      contextoPendente: { state, pendentes: outcome.pendentes, plan, mensagemId: mensagemId ?? null },
      ultimoHeartbeatEm: new Date().toISOString(),
    });
    emitter.emit({
      tipo: "confirmacao.necessaria",
      execucaoId,
      etapaId: etapa.id,
      nomePublico: outcome.ferramentaInterna,
      descricao: outcome.descricao,
    });
    return;
  }

  if (outcome.status === "cancelada") {
    if (state.evidence.length > 0) {
      await finishWithAnswer({
        execucaoId,
        mensagemId,
        conversaId,
        usuarioId,
        emitter,
        signal,
        budget,
        userMessage,
        plan,
        evidence: state.evidence,
        fontesColetadas: state.fontes,
        limiteAtingidoMotivo: "A execução foi interrompida pelo usuário antes de concluir.",
        camposSolicitados: plan.camposSolicitados,
        tokensEntradaAcumulado: state.tokensEntrada,
        tokensSaidaAcumulado: state.tokensSaida,
        forcarStatusParcial: true,
      });
    } else {
      await atualizarExecucao(execucaoId, { status: "cancelada", canceladoEm: new Date().toISOString() });
      if (mensagemId) await atualizarMensagem(mensagemId, { status: "cancelada", conteudo: "A execução foi interrompida." });
    }
    logNeoInfo("execucao.finalizada", { execucaoId, motivoFinalizacao: "cancelada", concluidas: state.evidence.filter((e) => e.ok).length });
    emitter.emit({ tipo: "execucao.cancelada" });
    return;
  }

  if (outcome.status === "falhou") {
    await failExecution(execucaoId, mensagemId, outcome.erroPublico);
    logNeoWarn("execucao.finalizada", { execucaoId, motivoFinalizacao: "falhou", concluidas: state.evidence.filter((e) => e.ok).length });
    emitter.emit({ tipo: "execucao.falhou", mensagem: outcome.erroPublico });
    return;
  }

  const limiteAtingidoMotivo = outcome.status === "limite_atingido" ? outcome.motivo : undefined;
  if (limiteAtingidoMotivo) {
    emitter.emit({ tipo: "execucao.parcial", motivo: limiteAtingidoMotivo });
  }

  await finishWithAnswer({
    execucaoId,
    mensagemId,
    conversaId,
    usuarioId,
    emitter,
    signal,
    budget,
    userMessage,
    plan,
    evidence: state.evidence,
    fontesColetadas: state.fontes,
    limiteAtingidoMotivo,
    camposSolicitados: plan.camposSolicitados,
    tokensEntradaAcumulado: state.tokensEntrada,
    tokensSaidaAcumulado: state.tokensSaida,
  });
}

interface FinishWithAnswerParams {
  execucaoId: string;
  mensagemId: string | undefined;
  conversaId: string;
  usuarioId: string;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
  budget: ExecutionBudget;
  userMessage: string;
  plan: NeoPlan | null;
  evidence: EvidenceEntry[];
  fontesColetadas: NormalizedFonte[];
  limiteAtingidoMotivo?: string;
  perguntaBloqueante?: string;
  camposSolicitados: string[];
  tokensEntradaAcumulado: number;
  tokensSaidaAcumulado: number;
  forcarStatusParcial?: boolean;
}

/** Below this, a real synthesis call has no realistic chance to finish inside the reserve — go straight to the deterministic fallback instead of starting doomed work. */
const MIN_SYNTHESIS_ATTEMPT_MS = 5_000;

async function finishWithAnswer(params: FinishWithAnswerParams): Promise<void> {
  const remaining = params.budget.synthesisRemainingMs();
  const canAttemptSynthesis = remaining >= MIN_SYNTHESIS_ATTEMPT_MS && !params.signal.aborted;

  let answer: NeoAnswer;
  let fontesParaRegistrar: NeoAnswer["fontes"];
  let tokensEntradaSintese = 0;
  let tokensSaidaSintese = 0;
  let relatorio: "completo" | "parcial" | "fallback" = "completo";

  const evidenceLike: FallbackEtapaLike[] = params.evidence;

  if (canAttemptSynthesis) {
    const synthesisTimeoutController = new AbortController();
    const synthesisTimer = setTimeout(() => synthesisTimeoutController.abort(), remaining);
    try {
      const synthesis = await synthesizeAnswer(
        {
          userMessage: params.userMessage,
          plan: params.plan,
          evidence: params.evidence,
          fontesColetadas: params.fontesColetadas,
          limiteAtingidoMotivo: params.limiteAtingidoMotivo,
          perguntaBloqueante: params.perguntaBloqueante ?? null,
        },
        AbortSignal.any([params.signal, synthesisTimeoutController.signal]),
      );
      tokensEntradaSintese = synthesis.tokensEntrada;
      tokensSaidaSintese = synthesis.tokensSaida;

      if (synthesis.validationFailed && hasFallbackEvidence(evidenceLike, params.fontesColetadas)) {
        // The model-based synthesis (including its own one retry) never produced valid
        // Structured Output — fall back to the deterministic, evidence-based report
        // instead of the generic text-only fallback, so completed work is never lost.
        answer = buildEvidenceFallbackAnswer({
          motivo: params.limiteAtingidoMotivo ?? "Não foi possível montar o relatório final da investigação.",
          etapas: evidenceLike,
          fontes: params.fontesColetadas,
        });
        fontesParaRegistrar = answer.fontes;
        relatorio = "fallback";
      } else {
        answer = synthesis.answer;
        fontesParaRegistrar = synthesis.fontes;
        relatorio = synthesis.validationFailed ? "fallback" : "completo";
      }
    } finally {
      clearTimeout(synthesisTimer);
    }
  } else {
    // No time left in the synthesis reserve for even one LLM round trip — build the
    // report directly from what's already persisted, with zero additional LLM calls.
    answer = buildEvidenceFallbackAnswer({
      motivo: params.limiteAtingidoMotivo ?? "A execução foi interrompida antes da preparação do relatório.",
      etapas: evidenceLike,
      fontes: params.fontesColetadas,
    });
    fontesParaRegistrar = answer.fontes;
    relatorio = "fallback";
  }

  if (params.forcarStatusParcial && answer.status === "completo") {
    answer = { ...answer, status: "parcial" };
  }

  for (const fonte of fontesParaRegistrar) {
    await registrarFonte({
      execucaoId: params.execucaoId,
      url: fonte.url,
      titulo: fonte.titulo,
      dominio: fonte.dominio,
      dataObservacao: fonte.dataAcesso,
    }).catch(() => {});
  }

  const camposAusentes = answer.informacoesAusentes;
  const camposEncontrados = params.camposSolicitados.filter((campo) => !camposAusentes.includes(campo));
  const execucaoStatus = answer.status === "parcial" ? "parcial" : "concluida";

  await atualizarExecucao(params.execucaoId, {
    status: execucaoStatus,
    camposEncontrados,
    camposAusentes,
    concluidoEm: new Date().toISOString(),
    tokensEntrada: params.tokensEntradaAcumulado + tokensEntradaSintese,
    tokensSaida: params.tokensSaidaAcumulado + tokensSaidaSintese,
  });

  if (params.mensagemId) {
    await atualizarMensagem(params.mensagemId, {
      status: answer.status === "parcial" ? "parcial" : "concluida",
      conteudo: answer.resumoExecutivo,
      respostaEstruturada: answer,
    });
  }

  await tocarConversa(params.conversaId).catch(() => {});
  logNeoInfo("execucao.finalizada", {
    execucaoId: params.execucaoId,
    motivoFinalizacao: params.limiteAtingidoMotivo ?? "concluida",
    concluidas: params.evidence.filter((e) => e.ok).length,
    orcamentoRestanteMs: params.budget.synthesisRemainingMs(),
    relatorio,
  });
  params.emitter.emit({ tipo: "resposta.concluida", mensagemId: params.mensagemId ?? "", resposta: answer });

  void refreshMemoryIfNeeded(params.conversaId, params.usuarioId);
}

async function refreshMemoryIfNeeded(conversaId: string, usuarioId: string): Promise<void> {
  try {
    const mensagens = await listarUltimasMensagens(conversaId, NEO_LIMITS.summaryRefreshThreshold + 5);
    if (mensagens.length < NEO_LIMITS.summaryRefreshThreshold) return;
    const conversa = await buscarConversaPorId(usuarioId, conversaId);
    const resumo = await refreshConversationSummary({
      resumoAnterior: conversa?.resumoContexto ?? null,
      mensagens: mensagens.map((m) => ({ papel: m.papel, conteudo: m.conteudo ?? "" })),
    });
    if (resumo) {
      await atualizarConversa(usuarioId, conversaId, { resumoContexto: resumo }).catch(() => {});
    }
  } catch {
    // best-effort — a missed summary refresh never blocks the conversation.
  }
}

/**
 * Resumes a paused execution after the user confirms or rejects a persistent
 * action (POST /api/triad3/neo/execucoes/[id]/confirmar). Runs on a fresh
 * SSE stream — the original /executar stream already closed when it paused.
 * Gets its own fresh execution budget, matching the fresh maxDuration window
 * this is a brand-new server invocation.
 */
export async function resumeNeoExecutionAfterConfirmation(params: {
  usuarioId: string;
  conversaId: string;
  execucaoId: string;
  confirmado: boolean;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
}): Promise<void> {
  const { usuarioId, conversaId, execucaoId, confirmado, emitter, signal } = params;
  const budget = createExecutionBudget();
  const localController = new AbortController();
  const hardTimeoutController = new AbortController();
  const hardTimer = setTimeout(() => hardTimeoutController.abort(), budget.hardDeadlineMs());
  const combinedSignal = AbortSignal.any([signal, localController.signal, hardTimeoutController.signal]);
  registerNeoExecution(execucaoId, localController);

  const heartbeatTimer = setInterval(() => {
    void atualizarExecucao(execucaoId, { ultimoHeartbeatEm: new Date().toISOString() }).catch(() => {});
    emitter.emit({ tipo: "heartbeat", execucaoId, decorridoMs: budget.elapsedMs() });
  }, NEO_LIMITS.heartbeatIntervalMs);

  try {
    const pending = await getExecutionPendingConfirmation(usuarioId, execucaoId);
    if (!pending) {
      emitter.emit({ tipo: "execucao.falhou", mensagem: "Não há confirmação pendente para esta execução." });
      return;
    }

    const { contexto } = pending;
    const etapasExistentes = await listarEtapas(execucaoId);
    const confirmationEtapa = [...etapasExistentes].reverse().find((e) => e.tipo === "confirmacao" && e.status === "aguardando");
    if (confirmationEtapa) {
      await atualizarEtapa(confirmationEtapa.id, {
        status: confirmado ? "concluida" : "cancelada",
        erroPublico: confirmado ? undefined : "Ação não confirmada pelo usuário.",
        concluidoEm: new Date().toISOString(),
      });
      emitter.emit({
        tipo: confirmado ? "etapa.concluida" : "etapa.falhou",
        etapaId: confirmationEtapa.id,
        ordem: confirmationEtapa.ordem,
        nomePublico: confirmationEtapa.nomePublico,
        ...(confirmado ? { resumo: "Ação confirmada pelo usuário." } : { mensagem: "Ação cancelada pelo usuário." }),
      } as Parameters<NeoEventEmitter["emit"]>[0]);
    }

    const state = contexto.state;
    if (!confirmado) {
      for (const call of contexto.pendentes) {
        state.evidence.push({
          ferramenta: call.name,
          nomePublico: call.name,
          argumentos: call.args,
          ok: false,
          resumo: null,
          erroPublico: "Ação não confirmada pelo usuário.",
        });
      }
    }

    await atualizarExecucao(execucaoId, { status: "executando", ultimoHeartbeatEm: new Date().toISOString() });
    emitter.emit({ tipo: "execucao.iniciada", execucaoId, mensagemId: contexto.mensagemId ?? "" });

    const ultimaMensagemUsuario = [...(await listarUltimasMensagens(conversaId, NEO_LIMITS.recentMessagesWindow))]
      .reverse()
      .find((m) => m.papel === "usuario");
    const userMessage = ultimaMensagemUsuario?.conteudo ?? contexto.plan.objetivoInterpretado;

    const ordemRef = { current: etapasExistentes.length };
    const totalRef = { current: countTerminalToolSteps(etapasExistentes) };
    const outcome = await runExecutor(contexto.plan, userMessage, buildExecutorCallbacks(execucaoId, emitter, ordemRef, totalRef), {
      usuarioId,
      signal: combinedSignal,
      budget,
      resumeState: state,
      resumeConfirmedCalls: confirmado ? contexto.pendentes : undefined,
    });

    await handleExecutorOutcome({
      execucaoId,
      conversaId,
      usuarioId,
      mensagemId: contexto.mensagemId ?? undefined,
      emitter,
      signal: combinedSignal,
      budget,
      userMessage,
      plan: contexto.plan,
      state: outcome.state,
      outcome: outcome.outcome,
    });
  } catch {
    const message = signal.aborted ? "A execução foi interrompida." : "Não foi possível continuar a investigação.";
    await failExecution(execucaoId, undefined, message);
    emitter.emit({ tipo: "execucao.falhou", mensagem: message });
  } finally {
    clearTimeout(hardTimer);
    clearInterval(heartbeatTimer);
    unregisterNeoExecution(execucaoId);
    emitter.close();
  }
}

function countTerminalToolSteps(etapas: NeoEtapaRow[]): number {
  return etapas.filter((e) => e.tipo === "ferramenta" && (e.status === "concluida" || e.status === "parcial" || e.status === "falhou")).length;
}

const ACTIVE_EXECUCAO_STATUSES = ["planejando", "executando", "verificando", "sintetizando", "aguardando_confirmacao"];

export type CancelExecutionResult =
  | { ok: true; jaFinalizada: boolean }
  | { ok: false; error: NeoError };

/** Called by POST /api/triad3/neo/execucoes/[id]/cancelar. Preserves any work already found — never discards it. */
export async function cancelNeoExecution(usuarioId: string, execucaoId: string): Promise<CancelExecutionResult> {
  const execucao = await buscarExecucaoPorId(usuarioId, execucaoId);
  if (!execucao) return { ok: false, error: neoError("not_found") };
  if (!ACTIVE_EXECUCAO_STATUSES.includes(execucao.status)) return { ok: true, jaFinalizada: true };

  const abortedSameInstance = requestNeoExecutionCancellation(execucaoId);
  if (!abortedSameInstance) {
    // Different instance, or the stream already finished between the status check and here — finalize
    // directly as a fallback so the conversation never gets stuck waiting on a cancellation nobody is
    // listening for, then sync the assistant message immediately (not just on next reconciliation) so
    // the UI reflects it as soon as the user refreshes.
    await atualizarExecucao(execucaoId, { status: "cancelada", canceladoEm: new Date().toISOString() });
    await reconcileConversationExecution(execucao.conversaId).catch(() => {});
  }
  return { ok: true, jaFinalizada: false };
}

export async function getExecutionPendingConfirmation(usuarioId: string, execucaoId: string) {
  const execucao = await buscarExecucaoPorId(usuarioId, execucaoId);
  if (!execucao || execucao.status !== "aguardando_confirmacao") return null;
  const contexto = execucao.contextoPendente as {
    state: ExecutorState;
    pendentes: PendingCall[];
    plan: NeoPlan;
    mensagemId: string | null;
  } | null;
  if (!contexto) return null;
  return { execucao, contexto };
}
