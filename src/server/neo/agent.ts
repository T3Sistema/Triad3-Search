import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { callNeoResponses } from "@/server/neo/client";
import { NEO_MODEL } from "@/server/neo/model";
import { NEO_SYSTEM_PROMPT } from "@/server/neo/prompt";
import { NEO_LIMITS } from "@/server/neo/limits";
import { buildResponsesTools, getNeoTool, isNeoToolPersistent } from "@/server/neo/tool-registry";
import { neoAgentTurnResponseSchema, type NeoAgentTurn } from "@/server/neo/schemas";
import { describeConfirmation } from "@/server/neo/confirmations";
import { normalizeThrownError } from "@/server/neo/errors";
import type { NormalizedFonte } from "@/server/neo/tool-normalizers";
import type { ExecutionBudget } from "@/server/neo/budget";
import { buildAgentContext, type ConversationTurn, type EvidenceEntry } from "@/server/neo/context-builder";
import type { NeoEntidadeMemoria } from "@/lib/neo/entity";

export type { EvidenceEntry };

/**
 * The single decision loop for Neo. Replaces the old four-call pipeline
 * (planner -> tool-calling rounds -> per-round objective evaluation ->
 * synthesizer) with ONE recurring call shape: every round, the model gets
 * `tools` (function calling, tool_choice "auto") AND a Structured Output
 * schema (`neoAgentTurnSchema`) for its final turn. It either emits
 * function_call items — the loop executes them and comes back with results
 * — or it emits a structured final decision (resposta/pergunta/formulario/
 * relatorio), which ends the turn. There is no separate call that only
 * decides "should we stop" — the same call that reads tool results decides
 * the next step, naturally, exactly like a human agent re-reading their own
 * notes each round instead of asking a colleague to grade their progress.
 */

export interface PendingCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

export interface NeoAgentState {
  round: number;
  toolCallsUsed: number;
  searchCallsUsed: number;
  evidence: EvidenceEntry[];
  executedSignatures: string[];
  fontes: NormalizedFonte[];
  tokensEntrada: number;
  tokensSaida: number;
}

export function createInitialAgentState(): NeoAgentState {
  return {
    round: 0,
    toolCallsUsed: 0,
    searchCallsUsed: 0,
    evidence: [],
    executedSignatures: [],
    fontes: [],
    tokensEntrada: 0,
    tokensSaida: 0,
  };
}

export interface EtapaConcluidaInfo {
  resumo: unknown;
  fontes: NormalizedFonte[];
  parcial: boolean;
}

export interface AgentCallbacks {
  onEtapaIniciada: (info: { nomePublico: string; ferramentaInterna: string; argumentos: unknown }) => Promise<string>;
  onEtapaConcluida: (etapaId: string, info: EtapaConcluidaInfo) => Promise<void>;
  onEtapaFalhou: (etapaId: string, mensagem: string) => Promise<void>;
}

export type NeoAgentOutcome =
  | { status: "concluido"; decisao: NeoAgentTurn }
  | { status: "aguardando_confirmacao"; pendentes: PendingCall[]; descricao: string; ferramentaInterna: string }
  | { status: "limite_atingido"; motivo: string }
  | { status: "cancelada" }
  | { status: "falhou"; erroPublico: string };

export interface RunAgentInput {
  userMessage: string;
  resumoContexto: string | null;
  mensagensRecentes: ConversationTurn[];
  entidades: NeoEntidadeMemoria;
  /** Only set on the round immediately after the user answered a formulário — never persisted in state. */
  valoresFormulario?: Record<string, unknown> | null;
}

export interface RunAgentOptions {
  usuarioId: string;
  signal: AbortSignal;
  /** Wall-clock budget shared across the whole execution — see src/server/neo/budget.ts. */
  budget: ExecutionBudget;
  resumeState?: NeoAgentState;
  /** When resuming a paused execution: the calls to run now that confirmation was granted. */
  resumeConfirmedCalls?: PendingCall[];
}

const TRANSIENT_MESSAGES = new Set([
  "O serviço demorou mais que o esperado para responder.",
  "O limite temporário de requisições foi atingido. Tente novamente em instantes.",
  "O serviço não conseguiu concluir a operação. Tente novamente em instantes.",
  "Não foi possível se comunicar com o serviço no momento.",
]);

function isTransientMessage(message: string | undefined): boolean {
  return Boolean(message && TRANSIENT_MESSAGES.has(message));
}

function stableStringify(args: Record<string, unknown>): string {
  const sorted = Object.keys(args)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

/**
 * Generic (no domain/entity hardcoding) stopword list used only to collapse a
 * search query down to its meaningful terms for de-duplication — e.g. "qual o
 * CNPJ do site x.com.br" and "x.com.br CNPJ" reduce to the same token set.
 */
const NEO_SEARCH_STOPWORDS = new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "ou",
  "que",
  "qual",
  "quais",
  "quem",
  "sao",
  "no",
  "na",
  "nos",
  "nas",
  "em",
  "para",
  "por",
  "com",
  "sobre",
  "site",
  "pagina",
  "informe",
  "informar",
  "encontre",
  "encontrar",
  "buscar",
  "pesquisar",
  "quero",
  "gostaria",
  "saber",
  "descobrir",
]);

/** Canonicalizes a search query into a sorted, deduped set of meaningful tokens — the basis for catching semantically-equivalent rewordings (see toolCallSignature). */
export function normalizeSearchQueryForDedup(query: string): string {
  const tokens = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/["'“”‘’]/g, "")
    .split(/[^a-z0-9.]+/)
    .filter((t) => t.length > 1 && !NEO_SEARCH_STOPWORDS.has(t));
  return Array.from(new Set(tokens)).sort().join(" ");
}

/**
 * De-duplication key for a tool call — considers the tool (implicitly the
 * strategy/objective it serves) plus its exact arguments (implicitly the
 * entity and field being queried); `pesquisar_web` queries are additionally
 * normalized so a reworded-but-equivalent query is recognized as a repeat
 * instead of burning another search. A real change to any of entidade,
 * objetivo, campo, or estratégia always changes either the tool name or the
 * argument values, so it always changes this signature too.
 */
export function toolCallSignature(name: string, args: Record<string, unknown>): string {
  if (name === "pesquisar_web" && typeof args.consulta === "string") {
    return `${name}:${stableStringify({ ...args, consulta: normalizeSearchQueryForDedup(args.consulta) })}`;
  }
  return `${name}:${stableStringify(args)}`;
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function runOneCall(
  call: PendingCall,
  state: NeoAgentState,
  callbacks: AgentCallbacks,
  ctx: { usuarioId: string; signal: AbortSignal; budget: ExecutionBudget },
): Promise<void> {
  const tool = getNeoTool(call.name);
  if (!tool) {
    state.evidence.push({ ferramenta: call.name, nomePublico: call.name, argumentos: call.args, ok: false, resumo: null, erroPublico: "Ferramenta desconhecida." });
    return;
  }

  const parsedArgs = tool.parameters.safeParse(call.args);
  if (!parsedArgs.success) {
    state.evidence.push({
      ferramenta: call.name,
      nomePublico: tool.nomePublico,
      argumentos: call.args,
      ok: false,
      resumo: null,
      erroPublico: "Argumentos inválidos para a ferramenta.",
    });
    return;
  }
  const args = parsedArgs.data as Record<string, unknown>;

  const signature = toolCallSignature(call.name, args);
  if (state.executedSignatures.includes(signature)) {
    state.evidence.push({
      ferramenta: call.name,
      nomePublico: tool.nomePublico,
      argumentos: args,
      ok: true,
      resumo: { aviso: "Consulta idêntica já executada anteriormente nesta análise; reaproveite o resultado anterior." },
    });
    return;
  }

  if (state.toolCallsUsed >= NEO_LIMITS.maxToolCalls) return;

  if (call.name === "pesquisar_web" && state.searchCallsUsed >= NEO_LIMITS.maxSearchCalls) {
    state.evidence.push({
      ferramenta: call.name,
      nomePublico: tool.nomePublico,
      argumentos: args,
      ok: false,
      resumo: null,
      erroPublico: "O limite de pesquisas desta análise foi atingido.",
    });
    return;
  }

  // No new tool call may start once the tool budget is exhausted — the remaining time is
  // reserved exclusively for the final decision. Never create a DB step for work that never starts.
  if (!ctx.budget.hasRoundBudget()) {
    state.evidence.push({
      ferramenta: call.name,
      nomePublico: tool.nomePublico,
      argumentos: args,
      ok: false,
      resumo: null,
      erroPublico: "O tempo disponível para esta análise se esgotou antes desta etapa começar.",
    });
    return;
  }

  state.toolCallsUsed += 1;
  if (call.name === "pesquisar_web") state.searchCallsUsed += 1;
  state.executedSignatures.push(signature);

  const etapaId = await callbacks.onEtapaIniciada({ nomePublico: tool.nomePublico, ferramentaInterna: call.name, argumentos: args });

  let attempt = 0;
  let lastErro = "Não foi possível concluir esta etapa.";
  while (attempt <= NEO_LIMITS.maxToolRetries) {
    attempt += 1;
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), tool.timeoutMs);
    const combinedSignal = AbortSignal.any([ctx.signal, timeoutController.signal]);
    try {
      const result = await tool.execute(args, { usuarioId: ctx.usuarioId, signal: combinedSignal });
      clearTimeout(timer);
      if (result.ok) {
        state.evidence.push({ ferramenta: call.name, nomePublico: tool.nomePublico, argumentos: args, ok: true, resumo: result.resumo });
        for (const fonte of result.fontes) {
          if (!state.fontes.some((f) => f.url === fonte.url)) state.fontes.push(fonte);
        }
        await callbacks.onEtapaConcluida(etapaId, { resumo: result.resumo, fontes: result.fontes, parcial: result.parcial });
        return;
      }
      lastErro = result.erroPublico ?? "Não foi possível concluir esta etapa.";
      if (!isTransientMessage(lastErro) || attempt > NEO_LIMITS.maxToolRetries || ctx.signal.aborted) break;
    } catch (err) {
      clearTimeout(timer);
      if (ctx.signal.aborted) {
        lastErro = "A execução foi interrompida.";
        break;
      }
      lastErro = normalizeThrownError(err).message;
      if (attempt > NEO_LIMITS.maxToolRetries) break;
    } finally {
      clearTimeout(timer);
    }
  }

  state.evidence.push({ ferramenta: call.name, nomePublico: tool.nomePublico, argumentos: args, ok: false, resumo: null, erroPublico: lastErro });
  await callbacks.onEtapaFalhou(etapaId, lastErro);
}

async function runCalls(
  calls: PendingCall[],
  state: NeoAgentState,
  callbacks: AgentCallbacks,
  ctx: { usuarioId: string; signal: AbortSignal; budget: ExecutionBudget },
): Promise<NeoAgentOutcome | null> {
  for (const batch of chunk(calls, NEO_LIMITS.maxParallelTools)) {
    if (ctx.signal.aborted) return { status: "cancelada" };
    if (!ctx.budget.hasRoundBudget()) break;
    await Promise.all(batch.map((call) => runOneCall(call, state, callbacks, ctx)));
  }
  return null;
}

function buildDecisionRepairPrompt(context: string): string {
  return `${context}\n\nA resposta anterior não seguiu exatamente o formato esperado (nem chamada de ferramenta válida, nem decisão estruturada válida). Decida novamente, seguindo estritamente o schema solicitado quando não for chamar uma ferramenta.`;
}

export async function runNeoAgent(
  input: RunAgentInput,
  callbacks: AgentCallbacks,
  options: RunAgentOptions,
): Promise<{ outcome: NeoAgentOutcome; state: NeoAgentState }> {
  const state = options.resumeState ?? createInitialAgentState();
  const ctx = { usuarioId: options.usuarioId, signal: options.signal, budget: options.budget };
  const tools = buildResponsesTools();

  if (options.resumeConfirmedCalls && options.resumeConfirmedCalls.length > 0) {
    const outcome = await runCalls(options.resumeConfirmedCalls, state, callbacks, ctx);
    if (outcome) return { outcome, state };
  }

  let valoresFormulario = input.valoresFormulario ?? null;

  while (state.round < NEO_LIMITS.maxRounds) {
    if (options.signal.aborted) return { outcome: { status: "cancelada" }, state };
    if (state.toolCallsUsed >= NEO_LIMITS.maxToolCalls) {
      return { outcome: { status: "limite_atingido", motivo: "O número máximo de consultas desta análise foi atingido." }, state };
    }
    if (!options.budget.hasRoundBudget()) {
      return { outcome: { status: "limite_atingido", motivo: "O tempo disponível para esta análise se esgotou." }, state };
    }

    state.round += 1;

    const context = buildAgentContext({
      userMessage: input.userMessage,
      resumoContexto: input.resumoContexto,
      mensagensRecentes: input.mensagensRecentes,
      entidades: input.entidades,
      evidence: state.evidence,
      valoresFormulario,
    });
    valoresFormulario = null; // only ever included once, right after the form was answered

    let response;
    try {
      response = await callNeoResponses(
        {
          model: NEO_MODEL,
          instructions: NEO_SYSTEM_PROMPT,
          input: context,
          tools,
          text: { format: zodTextFormat(neoAgentTurnResponseSchema, "neo_agent_turn") },
          reasoning: { effort: "high" },
          store: false,
        },
        options.signal,
      );
    } catch (err) {
      if (options.signal.aborted) return { outcome: { status: "cancelada" }, state };
      return { outcome: { status: "falhou", erroPublico: normalizeThrownError(err).message }, state };
    }

    state.tokensEntrada += response.usage?.input_tokens ?? 0;
    state.tokensSaida += response.usage?.output_tokens ?? 0;

    const functionCalls = (response.output ?? []).filter(
      (item): item is Extract<(typeof response.output)[number], { type: "function_call" }> => item.type === "function_call",
    );

    if (functionCalls.length > 0) {
      const calls: PendingCall[] = functionCalls.map((fc) => ({
        callId: fc.call_id,
        name: fc.name,
        args: safeParseArgs(fc.arguments),
      }));

      const persistentCall = calls.find((c) => isNeoToolPersistent(c.name));
      if (persistentCall) {
        const descricao = describeConfirmation(persistentCall.name, persistentCall.args);
        return { outcome: { status: "aguardando_confirmacao", pendentes: calls, descricao, ferramentaInterna: persistentCall.name }, state };
      }

      if (!options.budget.hasRoundBudget()) {
        return { outcome: { status: "limite_atingido", motivo: "O tempo disponível para esta análise se esgotou." }, state };
      }

      const outcome = await runCalls(calls, state, callbacks, ctx);
      if (outcome) return { outcome, state };
      continue;
    }

    const parsed = neoAgentTurnResponseSchema.safeParse(safeParseJson(response.output_text));
    if (parsed.success) {
      return { outcome: { status: "concluido", decisao: parsed.data.decisao }, state };
    }

    // One controlled correction attempt, per spec — never counted against the round limit,
    // since it's our own recovery, not the agent choosing to keep working.
    if (options.signal.aborted) return { outcome: { status: "cancelada" }, state };
    let retryResponse;
    try {
      retryResponse = await callNeoResponses(
        {
          model: NEO_MODEL,
          instructions: NEO_SYSTEM_PROMPT,
          input: buildDecisionRepairPrompt(context),
          tools,
          text: { format: zodTextFormat(neoAgentTurnResponseSchema, "neo_agent_turn") },
          reasoning: { effort: "high" },
          store: false,
        },
        options.signal,
      );
    } catch (err) {
      if (options.signal.aborted) return { outcome: { status: "cancelada" }, state };
      return { outcome: { status: "falhou", erroPublico: normalizeThrownError(err).message }, state };
    }
    state.tokensEntrada += retryResponse.usage?.input_tokens ?? 0;
    state.tokensSaida += retryResponse.usage?.output_tokens ?? 0;

    const retryFunctionCalls = (retryResponse.output ?? []).filter(
      (item): item is Extract<(typeof retryResponse.output)[number], { type: "function_call" }> => item.type === "function_call",
    );
    if (retryFunctionCalls.length > 0) {
      const calls: PendingCall[] = retryFunctionCalls.map((fc) => ({ callId: fc.call_id, name: fc.name, args: safeParseArgs(fc.arguments) }));
      const persistentCall = calls.find((c) => isNeoToolPersistent(c.name));
      if (persistentCall) {
        const descricao = describeConfirmation(persistentCall.name, persistentCall.args);
        return { outcome: { status: "aguardando_confirmacao", pendentes: calls, descricao, ferramentaInterna: persistentCall.name }, state };
      }
      const outcome = await runCalls(calls, state, callbacks, ctx);
      if (outcome) return { outcome, state };
      continue;
    }

    const retryParsed = neoAgentTurnResponseSchema.safeParse(safeParseJson(retryResponse.output_text));
    if (retryParsed.success) {
      return { outcome: { status: "concluido", decisao: retryParsed.data.decisao }, state };
    }

    return { outcome: { status: "falhou", erroPublico: "Não foi possível montar a resposta final." }, state };
  }

  return { outcome: { status: "limite_atingido", motivo: "O número máximo de rodadas desta análise foi atingido." }, state };
}

function safeParseJson(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Used only when the round loop above returns "limite_atingido" (tool budget
 * exhausted or max rounds reached) — a single extra call, paid for out of
 * the synthesis reserve (never the tool budget), that forces a terminal
 * decision from whatever evidence already exists. No `tools` are offered
 * here, so the model cannot keep working — it must respond, ask, or report
 * with what it has. Returns null (never throws) on any failure; the caller
 * falls back to the deterministic, evidence-only report builder.
 */
export async function forceNeoAgentConclusion(input: RunAgentInput, state: NeoAgentState, signal: AbortSignal): Promise<NeoAgentTurn | null> {
  const context = buildAgentContext({
    userMessage: input.userMessage,
    resumoContexto: input.resumoContexto,
    mensagensRecentes: input.mensagensRecentes,
    entidades: input.entidades,
    evidence: state.evidence,
  });
  const prompt = `${context}\n\nO tempo disponível para chamar mais ferramentas se esgotou. Não chame nenhuma ferramenta e não peça um formulário — decida agora, com o que já foi coletado: produza uma resposta direta ("resposta") ou o relatório final ("relatorio") com os dados concretos já confirmados, deixando claro em "lacunas" o que não foi possível confirmar a tempo.`;

  try {
    const response = await callNeoResponses(
      {
        model: NEO_MODEL,
        instructions: NEO_SYSTEM_PROMPT,
        input: prompt,
        text: { format: zodTextFormat(neoAgentTurnResponseSchema, "neo_agent_turn") },
        reasoning: { effort: "medium" },
        store: false,
      },
      signal,
    );
    const parsed = neoAgentTurnResponseSchema.safeParse(safeParseJson(response.output_text));
    return parsed.success ? parsed.data.decisao : null;
  } catch {
    return null;
  }
}
