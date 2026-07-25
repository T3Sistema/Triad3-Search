import "server-only";
import "@/server/neo/tools";
import { NEO_LIMITS } from "@/server/neo/limits";
import { createExecutionBudget, type ExecutionBudget } from "@/server/neo/budget";
import {
  runNeoAgent,
  forceNeoAgentConclusion,
  createInitialAgentState,
  type AgentCallbacks,
  type EtapaConcluidaInfo,
  type NeoAgentState,
  type PendingCall,
  type RunAgentInput,
} from "@/server/neo/agent";
import type { ConversationTurn } from "@/server/neo/context-builder";
import type { NeoAgentTurn } from "@/server/neo/schemas";
import { pruneUnusedFontes, type NeoAnswer } from "@/lib/neo/answer";
import { sanitizeBannedTerms } from "@/lib/neo/sanitize-terms";
import type { NeoClarificationForm } from "@/lib/neo/clarification-form";
import { buildEvidenceFallbackAnswer, summarizeToolResult, type FallbackEtapaLike } from "@/server/neo/fallback-answer";
import { refreshEntityMemoryFromAnswer, parseEntidadeMemoria } from "@/server/neo/entity-memory";
import { refreshConversationSummary } from "@/server/neo/memory";
import { NeoEventEmitter } from "@/server/neo/events";
import { registerNeoExecution, requestNeoExecutionCancellation, unregisterNeoExecution } from "@/server/neo/execution-registry";
import { reconcileConversationExecution } from "@/server/neo/reconciliation";
import { logNeoInfo, logNeoWarn } from "@/server/neo/observability";
import { neoError, type NeoError } from "@/server/neo/errors";

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
    return { ok: false, error: neoError("rate_limit", "Já existe uma análise em andamento nesta conversa.") };
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

function buildAgentCallbacks(
  execucaoId: string,
  emitter: NeoEventEmitter,
  ordemRef: { current: number },
  totalRef: { current: number },
): AgentCallbacks {
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

/** Mirrors agent.ts's toolCallSignature — kept local (not imported) so this stays independent of that module's mock surface in tests; both are trivial, stable, and covered by their own tests. */
function continuationSignature(name: string, args: Record<string, unknown>): string {
  const sorted = Object.keys(args)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {});
  return `${name}:${JSON.stringify(sorted)}`;
}

/** Loads a previous falhou/parcial execution's completed steps + sources as a seed state, so `Continuar análise` never re-pays for work already done. */
async function buildContinuationSeed(usuarioId: string, conversaId: string, continuarExecucaoId: string): Promise<NeoAgentState | null> {
  const anterior = await buscarExecucaoPorId(usuarioId, continuarExecucaoId);
  if (!anterior || anterior.conversaId !== conversaId) return null;
  if (anterior.status !== "falhou" && anterior.status !== "parcial") return null;

  const etapas = await listarEtapas(anterior.id);
  const state = createInitialAgentState();

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

  return state;
}

interface RunContext {
  execucaoId: string;
  conversaId: string;
  usuarioId: string;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
  budget: ExecutionBudget;
}

/** Runs a fresh (or resumed) agent turn and streams friendly events to the browser. */
export async function runNeoExecution(params: {
  execucaoId: string;
  mensagemUsuarioId: string;
  conversaId: string;
  usuarioId: string;
  mensagemTexto: string;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
  /** When the user chose "Continuar análise" on a previous falhou/parcial execution — seeds the new run with its completed steps and sources. */
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
  logNeoInfo("execucao.iniciada", { execucaoId });

  try {
    await atualizarExecucao(execucaoId, { ultimoHeartbeatEm: new Date().toISOString() }).catch(() => {});
    emitter.emit({ tipo: "execucao.iniciada", execucaoId, mensagemId: mensagemUsuarioId });

    const conversa = await buscarConversaPorId(usuarioId, conversaId);
    const recentes = await listarUltimasMensagens(conversaId, NEO_LIMITS.recentMessagesWindow);
    const mensagensRecentes: ConversationTurn[] = recentes
      .filter((m) => m.id !== mensagemUsuarioId && m.id !== assistantMessage?.id)
      .filter((m): m is typeof m & { conteudo: string } => Boolean(m.conteudo) && m.papel !== "sistema")
      .map((m) => ({ papel: m.papel === "usuario" ? "usuario" : "assistente", conteudo: m.conteudo }));

    await atualizarExecucao(execucaoId, { status: "executando" });

    const seedState = continuarExecucaoId ? await buildContinuationSeed(usuarioId, conversaId, continuarExecucaoId) : null;
    const input: RunAgentInput = {
      userMessage: mensagemTexto,
      resumoContexto: conversa?.resumoContexto ?? null,
      mensagensRecentes,
      entidades: parseEntidadeMemoria(conversa?.entidadesAtivas),
    };

    const ordemRef = { current: 0 };
    const totalRef = { current: 0 };
    const outcome = await runNeoAgent(input, buildAgentCallbacks(execucaoId, emitter, ordemRef, totalRef), {
      usuarioId,
      signal: combinedSignal,
      budget,
      resumeState: seedState ?? undefined,
    });

    await handleAgentOutcome(
      { execucaoId, conversaId, usuarioId, emitter, signal: combinedSignal, budget },
      assistantMessage?.id,
      input,
      outcome.outcome,
      outcome.state,
    );
  } catch {
    const message = signal.aborted ? "A execução foi interrompida." : "Não foi possível concluir a análise.";
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

async function handleAgentOutcome(
  rc: RunContext,
  mensagemId: string | undefined,
  input: RunAgentInput,
  outcome: Awaited<ReturnType<typeof runNeoAgent>>["outcome"],
  state: NeoAgentState,
): Promise<void> {
  if (outcome.status === "aguardando_confirmacao") {
    const etapa = await inserirEtapa({
      execucaoId: rc.execucaoId,
      ordem: 9999,
      tipo: "confirmacao",
      nomePublico: "Aguardando confirmação",
      ferramentaInterna: outcome.ferramentaInterna,
      status: "aguardando",
      argumentosSanitizados: outcome.pendentes,
    });
    await atualizarExecucao(rc.execucaoId, {
      status: "aguardando_confirmacao",
      contextoPendente: { state, pendentes: outcome.pendentes, mensagemId: mensagemId ?? null },
      ultimoHeartbeatEm: new Date().toISOString(),
    });
    rc.emitter.emit({
      tipo: "confirmacao.necessaria",
      execucaoId: rc.execucaoId,
      etapaId: etapa.id,
      nomePublico: outcome.ferramentaInterna,
      descricao: outcome.descricao,
    });
    return;
  }

  if (outcome.status === "cancelada") {
    if (state.evidence.length > 0) {
      await finalizeRelatorio(rc, mensagemId, buildFallback(state, "A execução foi interrompida pelo usuário antes de concluir."), { forcarParcial: true });
    } else {
      await atualizarExecucao(rc.execucaoId, { status: "cancelada", canceladoEm: new Date().toISOString() });
      if (mensagemId) await atualizarMensagem(mensagemId, { status: "cancelada", conteudo: "A execução foi interrompida." });
    }
    logNeoInfo("execucao.finalizada", { execucaoId: rc.execucaoId, motivoFinalizacao: "cancelada", concluidas: state.evidence.filter((e) => e.ok).length });
    rc.emitter.emit({ tipo: "execucao.cancelada" });
    return;
  }

  if (outcome.status === "falhou") {
    await failExecution(rc.execucaoId, mensagemId, outcome.erroPublico);
    logNeoWarn("execucao.finalizada", { execucaoId: rc.execucaoId, motivoFinalizacao: "falhou", concluidas: state.evidence.filter((e) => e.ok).length });
    rc.emitter.emit({ tipo: "execucao.falhou", mensagem: outcome.erroPublico });
    return;
  }

  if (outcome.status === "limite_atingido") {
    rc.emitter.emit({ tipo: "execucao.parcial", motivo: outcome.motivo });
    const remaining = rc.budget.synthesisRemainingMs();
    let decisao: NeoAgentTurn | null = null;
    if (remaining >= MIN_CONCLUSION_ATTEMPT_MS && !rc.signal.aborted) {
      const timeoutController = new AbortController();
      const timer = setTimeout(() => timeoutController.abort(), remaining);
      try {
        decisao = await forceNeoAgentConclusion(input, state, AbortSignal.any([rc.signal, timeoutController.signal]));
      } finally {
        clearTimeout(timer);
      }
    }
    if (decisao) {
      await applyAgentDecision(rc, mensagemId, state, decisao, { forcarParcial: true });
    } else {
      await finalizeRelatorio(rc, mensagemId, buildFallback(state, outcome.motivo), { forcarParcial: true });
    }
    return;
  }

  // outcome.status === "concluido"
  await applyAgentDecision(rc, mensagemId, state, outcome.decisao, {});
}

/** Below this, one more LLM call has no realistic chance to finish inside the reserve — go straight to the deterministic fallback instead of starting doomed work. */
const MIN_CONCLUSION_ATTEMPT_MS = 5_000;

function buildFallback(state: NeoAgentState, motivo: string): NeoAnswer {
  const evidenceLike: FallbackEtapaLike[] = state.evidence;
  return buildEvidenceFallbackAnswer({ motivo, etapas: evidenceLike, fontes: state.fontes });
}

async function applyAgentDecision(
  rc: RunContext,
  mensagemId: string | undefined,
  state: NeoAgentState,
  decisao: NeoAgentTurn,
  options: { forcarParcial?: boolean },
): Promise<void> {
  if (decisao.tipo === "relatorio") {
    await finalizeRelatorio(rc, mensagemId, decisao.relatorio, options);
    return;
  }
  if (decisao.tipo === "formulario") {
    await pauseForFormulario(rc, mensagemId, state, decisao.formulario);
    return;
  }
  // "resposta" ou "pergunta" — ambas viram uma mensagem conversacional normal.
  await finalizePlainReply(rc, mensagemId, decisao.texto);
}

async function finalizeRelatorio(
  rc: RunContext,
  mensagemId: string | undefined,
  relatorioBruto: NeoAnswer,
  options: { forcarParcial?: boolean },
): Promise<void> {
  let answer = sanitizeBannedTerms(pruneUnusedFontes(relatorioBruto));
  if (options.forcarParcial && answer.status === "completo") {
    answer = { ...answer, status: "parcial" };
  }

  for (const fonte of answer.fontes) {
    await registrarFonte({
      execucaoId: rc.execucaoId,
      url: fonte.url,
      titulo: fonte.titulo,
      dominio: fonte.dominio,
      dataObservacao: fonte.dataAcesso,
    }).catch(() => {});
  }

  const relatorioIncompleto = answer.status === "parcial" || answer.status === "nao_concluido";
  const execucaoStatus = relatorioIncompleto ? "parcial" : "concluida";

  await atualizarExecucao(rc.execucaoId, { status: execucaoStatus, concluidoEm: new Date().toISOString() });
  if (mensagemId) {
    await atualizarMensagem(mensagemId, {
      status: relatorioIncompleto ? "parcial" : "concluida",
      conteudo: answer.respostaDireta,
      respostaEstruturada: answer,
    });
  }

  await tocarConversa(rc.conversaId).catch(() => {});
  await refreshEntityMemoryIfChanged(rc.usuarioId, rc.conversaId, answer);

  logNeoInfo("execucao.finalizada", { execucaoId: rc.execucaoId, motivoFinalizacao: "concluida" });
  rc.emitter.emit({ tipo: "resposta.concluida", mensagemId: mensagemId ?? "", resposta: answer });
  void refreshMemoryIfNeeded(rc.conversaId, rc.usuarioId);
}

async function finalizePlainReply(rc: RunContext, mensagemId: string | undefined, texto: string): Promise<void> {
  await atualizarExecucao(rc.execucaoId, { status: "concluida", concluidoEm: new Date().toISOString() });
  if (mensagemId) {
    await atualizarMensagem(mensagemId, { status: "concluida", conteudo: texto, respostaEstruturada: null });
  }
  await tocarConversa(rc.conversaId).catch(() => {});
  logNeoInfo("execucao.finalizada", { execucaoId: rc.execucaoId, motivoFinalizacao: "concluida" });
  rc.emitter.emit({ tipo: "resposta.mensagem", mensagemId: mensagemId ?? "", texto });
  void refreshMemoryIfNeeded(rc.conversaId, rc.usuarioId);
}

async function pauseForFormulario(
  rc: RunContext,
  mensagemId: string | undefined,
  state: NeoAgentState,
  formulario: NeoClarificationForm,
): Promise<void> {
  await atualizarExecucao(rc.execucaoId, {
    status: "aguardando_confirmacao",
    contextoPendente: { state, pendentes: [], mensagemId: mensagemId ?? null, formulario },
    ultimoHeartbeatEm: new Date().toISOString(),
  });
  rc.emitter.emit({ tipo: "formulario.necessario", execucaoId: rc.execucaoId, mensagemId: mensagemId ?? "", formulario });
}

async function refreshEntityMemoryIfChanged(usuarioId: string, conversaId: string, answer: NeoAnswer): Promise<void> {
  try {
    const conversa = await buscarConversaPorId(usuarioId, conversaId);
    const atual = parseEntidadeMemoria(conversa?.entidadesAtivas);
    const nova = refreshEntityMemoryFromAnswer(atual, answer);
    if (JSON.stringify(nova) === JSON.stringify(atual)) return;
    await atualizarConversa(usuarioId, conversaId, { entidadesAtivas: nova }).catch(() => {});
  } catch {
    // best-effort — a missed entity-memory refresh never blocks the conversation.
  }
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
 * Resumes a paused execution after the user confirms/rejects a persistent
 * action, or answers a formulário (both use the same `aguardando_confirmacao`
 * pause). Runs on a fresh SSE stream — the original /executar stream already
 * closed when it paused. Gets its own fresh execution budget, matching the
 * fresh maxDuration window this is a brand-new server invocation.
 */
async function resumeNeoExecution(params: {
  usuarioId: string;
  conversaId: string;
  execucaoId: string;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
  onResume: (
    contexto: PendingContext,
    ctx: RunContext,
  ) => Promise<{ state: NeoAgentState; valoresFormulario?: Record<string, unknown> | null; resumeConfirmedCalls?: PendingCall[] }>;
}): Promise<void> {
  const { usuarioId, conversaId, execucaoId, emitter, signal } = params;
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

  const rc: RunContext = { execucaoId, conversaId, usuarioId, emitter, signal: combinedSignal, budget };

  try {
    const pending = await getExecutionPendingConfirmation(usuarioId, execucaoId);
    if (!pending) {
      emitter.emit({ tipo: "execucao.falhou", mensagem: "Não há confirmação pendente para esta execução." });
      return;
    }
    const { contexto } = pending;

    const { state, valoresFormulario, resumeConfirmedCalls } = await params.onResume(contexto, rc);

    await atualizarExecucao(execucaoId, { status: "executando", ultimoHeartbeatEm: new Date().toISOString() });
    emitter.emit({ tipo: "execucao.iniciada", execucaoId, mensagemId: contexto.mensagemId ?? "" });

    const conversa = await buscarConversaPorId(usuarioId, conversaId);
    const recentes = await listarUltimasMensagens(conversaId, NEO_LIMITS.recentMessagesWindow);
    const ultimaMensagemUsuario = [...recentes].reverse().find((m) => m.papel === "usuario");
    const mensagensRecentes: ConversationTurn[] = recentes
      .filter((m) => m.id !== ultimaMensagemUsuario?.id)
      .filter((m): m is typeof m & { conteudo: string } => Boolean(m.conteudo) && m.papel !== "sistema")
      .map((m) => ({ papel: m.papel === "usuario" ? "usuario" : "assistente", conteudo: m.conteudo }));

    const input: RunAgentInput = {
      userMessage: ultimaMensagemUsuario?.conteudo ?? "",
      resumoContexto: conversa?.resumoContexto ?? null,
      mensagensRecentes,
      entidades: parseEntidadeMemoria(conversa?.entidadesAtivas),
      valoresFormulario,
    };

    const etapasExistentes = await listarEtapas(execucaoId);
    const ordemRef = { current: etapasExistentes.length };
    const totalRef = { current: countTerminalToolSteps(etapasExistentes) };
    const outcome = await runNeoAgent(input, buildAgentCallbacks(execucaoId, emitter, ordemRef, totalRef), {
      usuarioId,
      signal: combinedSignal,
      budget,
      resumeState: state,
      resumeConfirmedCalls,
    });

    await handleAgentOutcome(rc, contexto.mensagemId ?? undefined, input, outcome.outcome, outcome.state);
  } catch {
    const message = signal.aborted ? "A execução foi interrompida." : "Não foi possível continuar a análise.";
    await failExecution(execucaoId, undefined, message);
    emitter.emit({ tipo: "execucao.falhou", mensagem: message });
  } finally {
    clearTimeout(hardTimer);
    clearInterval(heartbeatTimer);
    unregisterNeoExecution(execucaoId);
    emitter.close();
  }
}

/** Called by POST /api/triad3/neo/execucoes/[id]/confirmar. */
export async function resumeNeoExecutionAfterConfirmation(params: {
  usuarioId: string;
  conversaId: string;
  execucaoId: string;
  confirmado: boolean;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
}): Promise<void> {
  await resumeNeoExecution({
    usuarioId: params.usuarioId,
    conversaId: params.conversaId,
    execucaoId: params.execucaoId,
    emitter: params.emitter,
    signal: params.signal,
    onResume: async (contexto, rc) => {
      const etapasExistentes = await listarEtapas(rc.execucaoId);
      const confirmationEtapa = [...etapasExistentes].reverse().find((e) => e.tipo === "confirmacao" && e.status === "aguardando");
      if (confirmationEtapa) {
        await atualizarEtapa(confirmationEtapa.id, {
          status: params.confirmado ? "concluida" : "cancelada",
          erroPublico: params.confirmado ? undefined : "Ação não confirmada pelo usuário.",
          concluidoEm: new Date().toISOString(),
        });
        rc.emitter.emit({
          tipo: params.confirmado ? "etapa.concluida" : "etapa.falhou",
          etapaId: confirmationEtapa.id,
          ordem: confirmationEtapa.ordem,
          nomePublico: confirmationEtapa.nomePublico,
          ...(params.confirmado ? { resumo: "Ação confirmada pelo usuário." } : { mensagem: "Ação cancelada pelo usuário." }),
        } as Parameters<NeoEventEmitter["emit"]>[0]);
      }

      const state = contexto.state;
      if (!params.confirmado) {
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
        return { state };
      }

      return { state, resumeConfirmedCalls: contexto.pendentes };
    },
  });
}

/** Called by POST /api/triad3/neo/execucoes/[id]/formulario. */
export async function resumeNeoExecutionAfterForm(params: {
  usuarioId: string;
  conversaId: string;
  execucaoId: string;
  valores: Record<string, unknown>;
  emitter: NeoEventEmitter;
  signal: AbortSignal;
}): Promise<void> {
  await resumeNeoExecution({
    usuarioId: params.usuarioId,
    conversaId: params.conversaId,
    execucaoId: params.execucaoId,
    emitter: params.emitter,
    signal: params.signal,
    onResume: async (contexto) => ({ state: contexto.state, valoresFormulario: params.valores }),
  });
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

export interface PendingContext {
  state: NeoAgentState;
  pendentes: PendingCall[];
  mensagemId: string | null;
  formulario?: NeoClarificationForm;
}

export async function getExecutionPendingConfirmation(usuarioId: string, execucaoId: string) {
  const execucao = await buscarExecucaoPorId(usuarioId, execucaoId);
  if (!execucao || execucao.status !== "aguardando_confirmacao") return null;
  const contexto = execucao.contextoPendente as PendingContext | null;
  if (!contexto) return null;
  return { execucao, contexto };
}
