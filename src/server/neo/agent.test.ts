import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { runNeoAgent, forceNeoAgentConclusion, createInitialAgentState, normalizeSearchQueryForDedup, toolCallSignature } from "@/server/neo/agent";
import { createExecutionBudget } from "@/server/neo/budget";
import { clearNeoToolRegistryForTests, registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { NEO_LIMITS } from "@/server/neo/limits";

type FakeResponse = Awaited<ReturnType<typeof callNeoResponses>>;

function decisionResponse(functionCalls: Array<{ name: string; args: unknown }>): FakeResponse {
  return {
    usage: { input_tokens: 10, output_tokens: 5 },
    output: functionCalls.map((fc, i) => ({ type: "function_call" as const, call_id: `c${i}_${Math.random()}`, name: fc.name, arguments: JSON.stringify(fc.args) })),
  } as unknown as FakeResponse;
}

function turnResponse(decisao: unknown): FakeResponse {
  return { usage: { input_tokens: 20, output_tokens: 15 }, output_text: JSON.stringify({ decisao }) } as unknown as FakeResponse;
}

function textResponse(raw: string): FakeResponse {
  return { usage: { input_tokens: 5, output_tokens: 5 }, output_text: raw } as unknown as FakeResponse;
}

function callbacks() {
  let counter = 0;
  return {
    onEtapaIniciada: vi.fn(async () => `etapa-${++counter}`),
    onEtapaConcluida: vi.fn(async () => {}),
    onEtapaFalhou: vi.fn(async () => {}),
  };
}

function baseInput(overrides: Partial<Parameters<typeof runNeoAgent>[0]> = {}) {
  return {
    userMessage: "pergunta de teste",
    resumoContexto: null,
    mensagensRecentes: [],
    entidades: [],
    ...overrides,
  };
}

function registerFakeSearchTool(execute: (args: { consulta: string }) => Promise<NeoToolExecutionResult>) {
  registerNeoTool({
    name: "pesquisar_web" as never,
    nomePublico: "Pesquisar",
    description: "d",
    persistent: false,
    timeoutMs: 100,
    parameters: z.object({ consulta: z.string() }),
    execute,
  });
}

beforeEach(() => {
  clearNeoToolRegistryForTests();
  vi.mocked(callNeoResponses).mockReset();
});

describe("normalizeSearchQueryForDedup / toolCallSignature", () => {
  it("collapses stopwords and word order so equivalent queries share a signature", () => {
    expect(normalizeSearchQueryForDedup("carango.com.br CNPJ")).toBe(normalizeSearchQueryForDedup("CNPJ carango.com.br"));
    expect(normalizeSearchQueryForDedup("qual o CNPJ do site carango.com.br")).toBe(normalizeSearchQueryForDedup("carango.com.br CNPJ"));
  });

  it("treats a genuinely new identifier as a different signature", () => {
    const a = toolCallSignature("pesquisar_web", { consulta: "carango.com.br CNPJ" });
    const b = toolCallSignature("pesquisar_web", { consulta: "carango.com.br Instagram" });
    expect(a).not.toBe(b);
  });

  it("never conflates two different tools or two different non-search arguments", () => {
    const a = toolCallSignature("capturar_pagina", { url: "https://a.example" });
    const b = toolCallSignature("capturar_pagina", { url: "https://b.example" });
    expect(a).not.toBe(b);
  });
});

describe("runNeoAgent — conversa sem ferramenta", () => {
  it("responds directly from context on the very first round when no tool is needed", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(turnResponse({ tipo: "resposta", texto: "Já encontrei o CNPJ e o Instagram, aqui está o resumo." }));
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(callNeoResponses).toHaveBeenCalledTimes(1);
    expect(result.outcome).toEqual({ status: "concluido", decisao: { tipo: "resposta", texto: "Já encontrei o CNPJ e o Instagram, aqui está o resumo." } });
  });

  it("asks a clarifying question instead of guessing when genuinely ambiguous", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(turnResponse({ tipo: "pergunta", texto: "Você está falando de qual das duas empresas?" }));
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(result.outcome.status).toBe("concluido");
    if (result.outcome.status !== "concluido") throw new Error("expected concluido");
    expect(result.outcome.decisao.tipo).toBe("pergunta");
  });
});

describe("runNeoAgent — ferramentas", () => {
  it("executes a tool call then produces the final decision on the next round, never a separate evaluation call", async () => {
    const execute = vi.fn(async (): Promise<NeoToolExecutionResult> => ({
      ok: true,
      resumo: { resultados: [{ url: "https://a.example" }] },
      fontes: [{ url: "https://a.example", titulo: "A" }],
      parcial: false,
      informacoesAusentes: [],
    }));
    registerFakeSearchTool(execute);
    vi.mocked(callNeoResponses)
      .mockResolvedValueOnce(decisionResponse([{ name: "pesquisar_web", args: { consulta: "carango.com.br CNPJ" } }]))
      .mockResolvedValueOnce(turnResponse({ tipo: "resposta", texto: "Encontrado." }));
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(callNeoResponses).toHaveBeenCalledTimes(2); // one round to decide the tool, one to decide the final answer
    expect(result.state.fontes).toEqual([expect.objectContaining({ url: "https://a.example" })]);
  });

  it("never re-executes a reworded-but-equivalent query in the same run", async () => {
    const execute = vi.fn(async (): Promise<NeoToolExecutionResult> => ({ ok: true, resumo: { ok: true }, fontes: [], parcial: false, informacoesAusentes: [] }));
    registerFakeSearchTool(execute);
    vi.mocked(callNeoResponses)
      .mockResolvedValueOnce(decisionResponse([{ name: "pesquisar_web", args: { consulta: "carango.com.br CNPJ" } }]))
      .mockResolvedValueOnce(decisionResponse([{ name: "pesquisar_web", args: { consulta: "CNPJ carango.com.br" } }]))
      .mockResolvedValueOnce(turnResponse({ tipo: "resposta", texto: "Encontrado." }));
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(execute).toHaveBeenCalledTimes(1);
    const dedupEntry = result.state.evidence.find((e) => (e.resumo as { aviso?: string } | null)?.aviso);
    expect(dedupEntry?.resumo).toMatchObject({ aviso: expect.stringContaining("já executada") });
  });

  it("pauses for confirmation instead of executing a persistent tool, and never calls it", async () => {
    const execute = vi.fn(async (): Promise<NeoToolExecutionResult> => ({ ok: true, resumo: { excluido: true }, fontes: [], parcial: false, informacoesAusentes: [] }));
    registerNeoTool({
      name: "monitor_excluir" as never,
      nomePublico: "Excluir monitoramento",
      description: "d",
      persistent: true,
      timeoutMs: 100,
      parameters: z.object({ monitoramentoId: z.string() }),
      execute,
    });
    vi.mocked(callNeoResponses).mockResolvedValueOnce(decisionResponse([{ name: "monitor_excluir", args: { monitoramentoId: "m1" } }]));
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(execute).not.toHaveBeenCalled();
    expect(result.outcome).toMatchObject({ status: "aguardando_confirmacao", ferramentaInterna: "monitor_excluir" });
  });

  it("resumes with resumeConfirmedCalls executed before the loop continues", async () => {
    const execute = vi.fn(async (): Promise<NeoToolExecutionResult> => ({ ok: true, resumo: { excluido: true }, fontes: [], parcial: false, informacoesAusentes: [] }));
    registerNeoTool({
      name: "monitor_excluir" as never,
      nomePublico: "Excluir monitoramento",
      description: "d",
      persistent: true,
      timeoutMs: 100,
      parameters: z.object({ monitoramentoId: z.string() }),
      execute,
    });
    vi.mocked(callNeoResponses).mockResolvedValueOnce(turnResponse({ tipo: "resposta", texto: "Monitoramento excluído." }));
    const budget = createExecutionBudget();
    const state = createInitialAgentState();
    const result = await runNeoAgent(baseInput(), callbacks(), {
      usuarioId: "u1",
      signal: new AbortController().signal,
      budget,
      resumeState: state,
      resumeConfirmedCalls: [{ callId: "c1", name: "monitor_excluir", args: { monitoramentoId: "m1" } }],
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.outcome.status).toBe("concluido");
  });
});

describe("runNeoAgent — limites e robustez", () => {
  it("stops with limite_atingido once the tool-call budget is exhausted, never starting a new tool", async () => {
    const execute = vi.fn(async (): Promise<NeoToolExecutionResult> => ({ ok: true, resumo: {}, fontes: [], parcial: false, informacoesAusentes: [] }));
    registerFakeSearchTool(execute);
    // maxToolCalls is 12 — script rounds that keep proposing one new call each, until the limit is hit.
    for (let i = 0; i < NEO_LIMITS.maxRounds; i++) {
      vi.mocked(callNeoResponses).mockResolvedValueOnce(decisionResponse([{ name: "pesquisar_web", args: { consulta: `consulta única ${i}` } }]));
    }
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(result.outcome.status).toBe("limite_atingido");
    expect(execute.mock.calls.length).toBeLessThanOrEqual(NEO_LIMITS.maxRounds);
  });

  it("returns cancelada immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: controller.signal, budget });
    expect(result.outcome).toEqual({ status: "cancelada" });
    expect(callNeoResponses).not.toHaveBeenCalled();
  });

  it("retries exactly once on an invalid structured decision, then succeeds", async () => {
    vi.mocked(callNeoResponses)
      .mockResolvedValueOnce(textResponse("isto não é json válido"))
      .mockResolvedValueOnce(turnResponse({ tipo: "resposta", texto: "Recuperado." }));
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(callNeoResponses).toHaveBeenCalledTimes(2);
    expect(result.outcome).toEqual({ status: "concluido", decisao: { tipo: "resposta", texto: "Recuperado." } });
  });

  it("gives up after two consecutive invalid decisions, reporting falhou", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(textResponse("json ruim")).mockResolvedValueOnce(textResponse("ainda ruim"));
    const budget = createExecutionBudget();
    const result = await runNeoAgent(baseInput(), callbacks(), { usuarioId: "u1", signal: new AbortController().signal, budget });
    expect(result.outcome.status).toBe("falhou");
  });
});

describe("forceNeoAgentConclusion", () => {
  it("never offers tools — it can only produce a final decision or null", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(turnResponse({ tipo: "resposta", texto: "Concluído com o que havia." }));
    const state = createInitialAgentState();
    const decisao = await forceNeoAgentConclusion(baseInput(), state, new AbortController().signal);
    expect(decisao).toEqual({ tipo: "resposta", texto: "Concluído com o que havia." });
    const params = vi.mocked(callNeoResponses).mock.calls[0]![0];
    expect(params.tools).toBeUndefined();
  });

  it("returns null (never throws) when the call fails", async () => {
    vi.mocked(callNeoResponses).mockRejectedValueOnce(new Error("network"));
    const state = createInitialAgentState();
    const decisao = await forceNeoAgentConclusion(baseInput(), state, new AbortController().signal);
    expect(decisao).toBeNull();
  });
});
