import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { NEO_LIMITS } from "@/server/neo/limits";
import { runExecutor } from "@/server/neo/executor";
import { createExecutionBudget } from "@/server/neo/budget";
import { clearNeoToolRegistryForTests, registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { z } from "zod";

/**
 * Regression test for the real incident this fix targets: a three-field
 * request ("Investigue o site X e informe somente o CNPJ, o
 * proprietário/sócio/administrador e o arroba oficial do Instagram") burned
 * 6 searches + 3 page reads (9 tool calls total), hit the round limit, and
 * still came back with CNPJ/responsável unfound — despite that data being
 * trivially findable. No real domain/entity from the incident is
 * hardcoded here; the scenario is entity-agnostic on purpose.
 *
 * This test proves the fix's actual mechanisms (not model judgment, which
 * can't be unit-tested): goal-driven early stopping via objetivos +
 * avaliarObjetivos, and semantic de-duplication of reworded search queries.
 * The scripted mock model plays the role of a well-guided model (per the
 * strengthened prompt) so the test can show that, given reasonable tool
 * choices, the surrounding scaffolding lets the investigation finish early
 * and efficiently instead of getting in the way.
 */

type FakeResponse = Awaited<ReturnType<typeof callNeoResponses>>;

function decisionResponse(functionCalls: Array<{ name: string; args: unknown; callId?: string }>): FakeResponse {
  return {
    usage: { input_tokens: 20, output_tokens: 10 },
    output: functionCalls.map((fc, i) => ({
      type: "function_call" as const,
      call_id: fc.callId ?? `call_${Math.random()}_${i}`,
      name: fc.name,
      arguments: JSON.stringify(fc.args),
    })),
  } as unknown as FakeResponse;
}

function noToolsResponse(): FakeResponse {
  return { usage: { input_tokens: 5, output_tokens: 5 }, output: [] } as unknown as FakeResponse;
}

function evaluationResponse(body: unknown): FakeResponse {
  return { usage: { input_tokens: 15, output_tokens: 15 }, output_text: JSON.stringify(body) } as unknown as FakeResponse;
}

const plan = {
  objetivoInterpretado: "Identificar CNPJ, sócio/administrador e Instagram oficial do site investigado.",
  ambiguidadeBloqueante: false,
  perguntaNecessaria: null,
  etapasPlanejadas: ["Descobrir identificadores", "Localizar CNPJ", "Localizar responsável", "Localizar Instagram"],
  dadosNecessarios: ["CNPJ", "sócio ou administrador", "Instagram oficial"],
  criteriosConclusao: ["CNPJ localizado", "responsável identificado", "Instagram localizado"],
  ferramentasProvaveis: [],
  execucaoParalelaPossivel: true,
  riscoConfusaoEntidades: null,
  camposSolicitados: ["CNPJ", "sócio ou administrador", "Instagram oficial"],
  formatoRelatorioEsperado: "texto",
};

function callbacks() {
  let counter = 0;
  return {
    onEtapaIniciada: vi.fn(async () => `etapa-${++counter}`),
    onEtapaConcluida: vi.fn(async () => {}),
    onEtapaFalhou: vi.fn(async () => {}),
  };
}

beforeEach(() => {
  clearNeoToolRegistryForTests();
  vi.mocked(callNeoResponses).mockReset();
});

describe("Investigação eficiente orientada por objetivos (regressão do incidente)", () => {
  it("resolve os três objetivos com poucas chamadas relevantes, ignora a página irrelevante e o distrator cheio de links, não repete consulta semanticamente equivalente, e encerra antes de esgotar o orçamento", async () => {
    const pesquisarExecute = vi.fn(async (args: { consulta: string }): Promise<NeoToolExecutionResult> => {
      if (args.consulta.includes("Instagram")) {
        return {
          ok: true,
          resumo: {
            consulta: args.consulta,
            resultados: [{ url: "https://social.example/alvo_oficial", titulo: "@alvo_oficial no Instagram", trecho: "Perfil oficial no Instagram: @alvo_oficial" }],
            totalResultados: 1,
          },
          fontes: [{ url: "https://social.example/alvo_oficial", titulo: "@alvo_oficial no Instagram", dominio: "social.example" }],
          parcial: false,
          informacoesAusentes: [],
        };
      }
      if (args.consulta.includes("CNPJ")) {
        return {
          ok: true,
          resumo: {
            consulta: args.consulta,
            resultados: [{ url: "https://empresarial.example/alvo", titulo: "Alvo Comércio Ltda. — dados cadastrais", trecho: "Consulte o CNPJ e o quadro societário completo." }],
            totalResultados: 1,
          },
          fontes: [{ url: "https://empresarial.example/alvo", titulo: "Alvo Comércio Ltda.", dominio: "empresarial.example" }],
          parcial: false,
          informacoesAusentes: [],
        };
      }
      if (args.consulta.includes("responsável")) {
        // "uma pesquisa sem resultado" — required mock scenario.
        return { ok: true, resumo: { consulta: args.consulta, resultados: [], totalResultados: 0 }, fontes: [], parcial: false, informacoesAusentes: ["Nenhum resultado encontrado."] };
      }
      // "um resultado irrelevante" — required mock scenario: unrelated content, no useful fonte.
      return {
        ok: true,
        resumo: { consulta: args.consulta, resultados: [{ url: "https://noticias.example/outro-assunto", titulo: "Notícia sem relação com o alvo", trecho: "Assunto totalmente diferente." }], totalResultados: 1 },
        fontes: [{ url: "https://noticias.example/outro-assunto", titulo: "Notícia sem relação", dominio: "noticias.example" }],
        parcial: false,
        informacoesAusentes: [],
      };
    });
    registerNeoTool({
      name: "pesquisar_web" as never,
      nomePublico: "Pesquisando fontes",
      description: "d",
      persistent: false,
      timeoutMs: 100,
      parameters: z.object({ consulta: z.string() }),
      execute: pesquisarExecute,
    });

    const capturarExecute = vi.fn(async (args: { url: string }): Promise<NeoToolExecutionResult> => {
      if (args.url === "https://empresarial.example/alvo") {
        return {
          ok: true,
          resumo: { markdown: "Alvo Comércio Ltda. — CNPJ 12.345.678/0001-99. Sócio administrador: Fulano de Tal." },
          fontes: [],
          parcial: false,
          informacoesAusentes: [],
        };
      }
      // "página com muitos links e nenhum dado útil" — required mock scenario.
      return {
        ok: true,
        resumo: { markdown: "", links: Array.from({ length: 30 }, (_, i) => ({ url: `https://diretorio.example/l${i}` })) },
        fontes: [],
        parcial: false,
        informacoesAusentes: [],
      };
    });
    registerNeoTool({
      name: "capturar_pagina" as never,
      nomePublico: "Lendo página",
      description: "d",
      persistent: false,
      timeoutMs: 100,
      parameters: z.object({ url: z.string(), formatos: z.array(z.string()).default([]) }),
      execute: capturarExecute,
    });

    const extrairExecute = vi.fn(async (): Promise<NeoToolExecutionResult> => ({
      ok: true,
      resumo: { json: { cnpj: "12.345.678/0001-99", responsavel: "Fulano de Tal", papel: "sócio administrador" } },
      fontes: [],
      parcial: false,
      informacoesAusentes: [],
    }));
    registerNeoTool({
      name: "extrair_dados" as never,
      nomePublico: "Extraindo informações",
      description: "d",
      persistent: false,
      timeoutMs: 100,
      parameters: z.object({ markdown: z.string().nullable(), instrucao: z.string(), campos: z.array(z.string()) }),
      execute: extrairExecute,
    });

    vi.mocked(callNeoResponses)
      // Round 1: targeted queries — one per objective, plus the incident's two required negative scenarios.
      .mockResolvedValueOnce(
        decisionResponse([
          { name: "pesquisar_web", args: { consulta: "alvo.com.br CNPJ" } },
          { name: "pesquisar_web", args: { consulta: "alvo.com.br Instagram" } },
          { name: "pesquisar_web", args: { consulta: "alvo.com.br notícias" } },
          { name: "pesquisar_web", args: { consulta: "administrador responsável alvo.com.br" } },
        ]),
      )
      // Evaluation after round 1: Instagram resolved; CNPJ/responsável still need the source captured.
      .mockResolvedValueOnce(
        evaluationResponse({
          objetivos: [
            { descricao: "CNPJ", status: "pendente" },
            { descricao: "sócio ou administrador", status: "pendente" },
            { descricao: "Instagram oficial", status: "encontrado" },
          ],
          podeEncerrar: false,
          motivo: "CNPJ e responsável ainda precisam da página capturada.",
        }),
      )
      // Round 2: captures the selected business source + (imperfect model) also captures a link-heavy distractor,
      // and attempts a reworded-but-equivalent repeat of round 1's CNPJ query — must not re-run.
      .mockResolvedValueOnce(
        decisionResponse([
          { name: "capturar_pagina", args: { url: "https://empresarial.example/alvo", formatos: ["resumo"] } },
          { name: "capturar_pagina", args: { url: "https://diretorio.example/alvo", formatos: ["links"] } },
          { name: "pesquisar_web", args: { consulta: "CNPJ alvo.com.br" } },
        ]),
      )
      // Evaluation after round 2: still need structured extraction before trusting the raw markdown.
      .mockResolvedValueOnce(
        evaluationResponse({
          objetivos: [
            { descricao: "CNPJ", status: "pendente" },
            { descricao: "sócio ou administrador", status: "pendente" },
            { descricao: "Instagram oficial", status: "encontrado" },
          ],
          podeEncerrar: false,
          motivo: "Extrair os campos exatos da página já capturada.",
        }),
      )
      // Round 3: extract the exact fields from the captured markdown.
      .mockResolvedValueOnce(
        decisionResponse([
          {
            name: "extrair_dados",
            args: { markdown: "Alvo Comércio Ltda. — CNPJ 12.345.678/0001-99. Sócio administrador: Fulano de Tal.", instrucao: "Extrair CNPJ e responsável", campos: ["CNPJ", "responsável"] },
          },
        ]),
      )
      // Evaluation after round 3: everything resolved — stop.
      .mockResolvedValueOnce(
        evaluationResponse({
          objetivos: [
            { descricao: "CNPJ", status: "encontrado" },
            { descricao: "sócio ou administrador", status: "encontrado" },
            { descricao: "Instagram oficial", status: "encontrado" },
          ],
          podeEncerrar: true,
          motivo: "Todos os objetivos foram respondidos.",
        }),
      )
      // Safety net only — a 7th call would mean the loop kept going after podeEncerrar=true.
      .mockResolvedValue(noToolsResponse());

    const cb = callbacks();
    const budget = createExecutionBudget();
    const { outcome, state } = await runExecutor(plan, "Investigue o site e informe o CNPJ, o responsável e o Instagram oficial.", cb, {
      usuarioId: "u1",
      signal: new AbortController().signal,
      budget,
    });

    // 1. Objectives created from camposSolicitados.
    expect(state.objetivos.map((o) => o.descricao)).toEqual(["CNPJ", "sócio ou administrador", "Instagram oficial"]);
    // 2/4/5/6. Targeted queries ran, the business source was selected and extracted, the official profile was identified.
    expect(pesquisarExecute).toHaveBeenCalledWith(expect.objectContaining({ consulta: "alvo.com.br CNPJ" }), expect.anything());
    expect(capturarExecute).toHaveBeenCalledWith(expect.objectContaining({ url: "https://empresarial.example/alvo" }), expect.anything());
    expect(extrairExecute).toHaveBeenCalled();
    // 3. The irrelevant search result and the link-heavy distractor never block completion — both ran but
    // contributed nothing, and the final objective state ignores them entirely.
    expect(state.objetivos.every((o) => o.status === "encontrado")).toBe(true);
    // 7/8. The reworded duplicate ("CNPJ alvo.com.br" vs "alvo.com.br CNPJ") never re-executed the tool,
    // and the search budget was never exhausted (4 real searches out of a maxSearchCalls of 6).
    expect(pesquisarExecute).toHaveBeenCalledTimes(4);
    expect(state.searchCallsUsed).toBe(4);
    expect(state.searchCallsUsed).toBeLessThan(NEO_LIMITS.maxSearchCalls);
    const dedupEntry = state.evidence.find((e) => (e.resumo as { aviso?: string } | null)?.aviso);
    expect(dedupEntry?.resumo).toMatchObject({ aviso: expect.stringContaining("já executada") });
    // 9/10/11. Stops before exhausting rounds, produces a report-ready outcome, and never surfaces a
    // rounds-limit warning — this must read as "resolved", never as a budget failure.
    expect(state.round).toBeLessThan(NEO_LIMITS.maxRounds);
    expect(outcome).toEqual({ status: "sem_ferramentas" });
    expect(state.toolCallsUsed).toBeLessThan(9);
    // The evaluation call never ran a 7th time (loop stopped exactly when podeEncerrar became true).
    expect(callNeoResponses).toHaveBeenCalledTimes(6);
  });
});
