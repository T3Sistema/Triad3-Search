// @vitest-environment jsdom
import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { runExecutor } from "@/server/neo/executor";
import { createExecutionBudget } from "@/server/neo/budget";
import { clearNeoToolRegistryForTests, registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { synthesizeAnswer, assignFonteIds } from "@/server/neo/synthesizer";
import { buildEvidenceFallbackAnswer } from "@/server/neo/fallback-answer";
import { AnswerView } from "@/components/neo/answer-view";
import type { NeoAnswer } from "@/lib/neo/answer";

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * The single mandated end-to-end scenario for this fix: a request asking for
 * a domain's CNPJ, sócio/administrador and official Instagram handle, mixed
 * with the exact kind of noise that caused the original incident — a
 * homonym company, irrelevant social posts, and a link-heavy page with no
 * usable data. All identifying values below (CNPJ, razão social, person
 * name, handle) are fixture-only, invented for this test and never
 * referenced by production code.
 *
 * Proves, across the real executor -> deterministic fallback -> synthesizer
 * -> AnswerView pipeline: 3 independent objectives, business-source
 * selection, relevant-page capture, value extraction, rejection of
 * irrelevant/homonym results, a complete report with the exact 9-section
 * hierarchy, zero technical steps/counts treated as evidence, zero banned
 * terms reaching the rendered report, and the "N resultados !== N fontes"
 * distinction (13 collected results, only 3 genuinely cited sources).
 */

const CNPJ = "10.315.072/0001-81";
const RAZAO_SOCIAL = "B e B Produções e Eventos Ltda";
const RESPONSAVEL = "Fabio Rodrigo Bizetto";
const ARROBA = "@carango.com.br";

const officialBizUrl = "https://empresarial.example/carango-comercio";
const homonymUrl = "https://empresarial.example/bb-producoes-outra";
const irrelevantNewsUrl = "https://noticias.example/outro-assunto";
const quadroSocietarioUrl = "https://empresarial.example/carango-quadro-societario";
const extraIrrelevant1 = "https://blog.example/assunto-sem-relacao-1";
const officialInstaUrl = "https://instagram.example/carango.com.br";
const irrelevantPost1 = "https://instagram.example/post-irrelevante-1";
const irrelevantPost2 = "https://instagram.example/post-irrelevante-2";
const irrelevantPost3 = "https://instagram.example/post-irrelevante-3";
const extraIrrelevant2 = "https://blog.example/assunto-sem-relacao-2";
const extraIrrelevant3 = "https://forum.example/topico-sem-relacao";
const linkHeavyUrl = "https://diretorio.example/carango";
const extraIrrelevant4 = "https://blog.example/assunto-sem-relacao-4";

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

function evaluationResponse(body: unknown): FakeResponse {
  return { usage: { input_tokens: 15, output_tokens: 15 }, output_text: JSON.stringify(body) } as unknown as FakeResponse;
}

function textResponse(outputText: string): FakeResponse {
  return { usage: { input_tokens: 30, output_tokens: 60 }, output_text: outputText } as unknown as FakeResponse;
}

const plan = {
  objetivoInterpretado: "Identificar CNPJ, sócio/administrador e Instagram oficial de Carango.com.br.",
  ambiguidadeBloqueante: false,
  perguntaNecessaria: null,
  etapasPlanejadas: ["Descobrir identificadores", "Localizar CNPJ", "Localizar responsável", "Localizar Instagram"],
  dadosNecessarios: ["CNPJ", "sócio ou administrador", "Instagram oficial"],
  criteriosConclusao: ["CNPJ localizado", "responsável identificado", "Instagram localizado"],
  ferramentasProvaveis: [],
  execucaoParalelaPossivel: true,
  riscoConfusaoEntidades: "Existe uma empresa homônima (B & B Produções Ltda) que não deve ser confundida com o domínio pesquisado.",
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

function registerScenarioTools() {
  const pesquisarExecute = vi.fn(async (args: { consulta: string }): Promise<NeoToolExecutionResult> => {
    if (args.consulta.includes("CNPJ")) {
      return {
        ok: true,
        resumo: {
          consulta: args.consulta,
          resultados: [
            { url: officialBizUrl, titulo: "B e B Produções e Eventos Ltda — dados cadastrais", trecho: "CNPJ e quadro societário do domínio pesquisado." },
            { url: homonymUrl, titulo: "B & B Produções Ltda — outra empresa (SP)", trecho: "Empresa homônima sem relação com o domínio pesquisado." },
            { url: irrelevantNewsUrl, titulo: "Notícia sem relação com o alvo", trecho: "Assunto totalmente diferente." },
          ],
          totalResultados: 3,
        },
        fontes: [
          { url: officialBizUrl, titulo: "B e B Produções e Eventos Ltda", dominio: "empresarial.example" },
          { url: homonymUrl, titulo: "B & B Produções Ltda", dominio: "empresarial.example" },
          { url: irrelevantNewsUrl, titulo: "Notícia sem relação", dominio: "noticias.example" },
        ],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    if (args.consulta.includes("sócio") || args.consulta.includes("administrador")) {
      return {
        ok: true,
        resumo: {
          consulta: args.consulta,
          resultados: [
            { url: quadroSocietarioUrl, titulo: "Quadro societário — Carango.com.br", trecho: "Documento com nome e função do responsável." },
            { url: extraIrrelevant1, titulo: "Assunto sem relação", trecho: "Nada a ver com o alvo." },
          ],
          totalResultados: 2,
        },
        fontes: [
          { url: quadroSocietarioUrl, titulo: "Quadro societário", dominio: "empresarial.example" },
          { url: extraIrrelevant1, titulo: "Assunto sem relação", dominio: "blog.example" },
        ],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    if (args.consulta.includes("Instagram")) {
      return {
        ok: true,
        resumo: {
          consulta: args.consulta,
          resultados: [
            { url: irrelevantPost1, titulo: "Post irrelevante 1", trecho: "Assunto sem relação com o domínio." },
            { url: irrelevantPost2, titulo: "Post irrelevante 2", trecho: "Assunto sem relação com o domínio." },
            { url: irrelevantPost3, titulo: "Post irrelevante 3", trecho: "Assunto sem relação com o domínio." },
            { url: officialInstaUrl, titulo: `${ARROBA} no Instagram`, trecho: "Perfil oficial relacionado ao domínio pesquisado." },
          ],
          totalResultados: 4,
        },
        fontes: [
          { url: irrelevantPost1, titulo: "Post irrelevante 1", dominio: "instagram.example" },
          { url: irrelevantPost2, titulo: "Post irrelevante 2", dominio: "instagram.example" },
          { url: irrelevantPost3, titulo: "Post irrelevante 3", dominio: "instagram.example" },
          { url: officialInstaUrl, titulo: ARROBA, dominio: "instagram.example" },
        ],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    // Catch-all / reworded-duplicate query — never a new field, just noise plus the link-heavy distractor.
    return {
      ok: true,
      resumo: {
        consulta: args.consulta,
        resultados: [
          { url: extraIrrelevant2, titulo: "Assunto sem relação 2", trecho: "Nada a ver." },
          { url: extraIrrelevant3, titulo: "Assunto sem relação 3", trecho: "Nada a ver." },
          { url: linkHeavyUrl, titulo: "Diretório com muitos links", trecho: "Listagem genérica, sem dado útil." },
          { url: extraIrrelevant4, titulo: "Assunto sem relação 4", trecho: "Nada a ver." },
        ],
        totalResultados: 4,
      },
      fontes: [
        { url: extraIrrelevant2, titulo: "Assunto sem relação 2", dominio: "blog.example" },
        { url: extraIrrelevant3, titulo: "Assunto sem relação 3", dominio: "forum.example" },
        { url: linkHeavyUrl, titulo: "Diretório", dominio: "diretorio.example" },
        { url: extraIrrelevant4, titulo: "Assunto sem relação 4", dominio: "blog.example" },
      ],
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
    if (args.url === officialBizUrl) {
      return {
        ok: true,
        resumo: { markdown: `${RAZAO_SOCIAL} — CNPJ ${CNPJ}. Sócio administrador: ${RESPONSAVEL}.` },
        fontes: [],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    if (args.url === officialInstaUrl) {
      return {
        ok: true,
        resumo: { markdown: `${ARROBA} — Perfil oficial. Bio: Loja oficial Carango, peças e acessórios.` },
        fontes: [],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    // "página com muitos links e nenhum dado útil" — required distractor scenario.
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

  const extrairExecute = vi.fn(async (args: { url: string | null }): Promise<NeoToolExecutionResult> => {
    if (args.url === officialBizUrl) {
      return { ok: true, resumo: { json: { cnpj: CNPJ, responsavel: RESPONSAVEL } }, fontes: [], parcial: false, informacoesAusentes: [] };
    }
    if (args.url === officialInstaUrl) {
      return { ok: true, resumo: { json: { arroba: ARROBA } }, fontes: [], parcial: false, informacoesAusentes: [] };
    }
    return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico: "fonte não suportada neste teste" };
  });
  registerNeoTool({
    name: "extrair_dados" as never,
    nomePublico: "Extraindo informações",
    description: "d",
    persistent: false,
    timeoutMs: 100,
    parameters: z.object({ url: z.string().nullable(), markdown: z.string().nullable(), instrucao: z.string(), campos: z.array(z.string()) }),
    execute: extrairExecute,
  });

  return { pesquisarExecute, capturarExecute, extrairExecute };
}

function scriptDecisionAndEvaluationCalls() {
  vi.mocked(callNeoResponses)
    // Round 1: one targeted query per objective, plus a catch-all that surfaces the link-heavy distractor.
    .mockResolvedValueOnce(
      decisionResponse([
        { name: "pesquisar_web", args: { consulta: "carango.com.br CNPJ" } },
        { name: "pesquisar_web", args: { consulta: "sócio administrador carango.com.br" } },
        { name: "pesquisar_web", args: { consulta: "carango.com.br Instagram" } },
        { name: "pesquisar_web", args: { consulta: "carango.com.br notícias" } },
      ]),
    )
    .mockResolvedValueOnce(
      evaluationResponse({
        objetivos: [
          { descricao: "CNPJ", status: "pendente" },
          { descricao: "sócio ou administrador", status: "pendente" },
          { descricao: "Instagram oficial", status: "pendente" },
        ],
        podeEncerrar: false,
        motivo: "CNPJ, responsável e Instagram ainda precisam de captura e extração da fonte selecionada.",
      }),
    )
    // Round 2: captures the two relevant sources, also captures the link-heavy distractor (imperfect model),
    // and attempts a reworded-but-equivalent repeat of round 1's CNPJ query — must not re-run.
    .mockResolvedValueOnce(
      decisionResponse([
        { name: "capturar_pagina", args: { url: officialBizUrl, formatos: ["resumo"] } },
        { name: "capturar_pagina", args: { url: officialInstaUrl, formatos: ["resumo"] } },
        { name: "capturar_pagina", args: { url: linkHeavyUrl, formatos: ["links"] } },
        { name: "pesquisar_web", args: { consulta: "CNPJ carango.com.br" } },
      ]),
    )
    .mockResolvedValueOnce(
      evaluationResponse({
        objetivos: [
          { descricao: "CNPJ", status: "pendente" },
          { descricao: "sócio ou administrador", status: "pendente" },
          { descricao: "Instagram oficial", status: "pendente" },
        ],
        podeEncerrar: false,
        motivo: "Extrair os campos exatos das páginas já capturadas.",
      }),
    )
    // Round 3: extracts the exact fields from the two relevant captured pages.
    .mockResolvedValueOnce(
      decisionResponse([
        { name: "extrair_dados", args: { url: officialBizUrl, markdown: null, instrucao: "Extrair CNPJ e responsável", campos: ["cnpj", "responsavel"] } },
        { name: "extrair_dados", args: { url: officialInstaUrl, markdown: null, instrucao: "Extrair arroba oficial", campos: ["arroba"] } },
      ]),
    )
    .mockResolvedValueOnce(
      evaluationResponse({
        objetivos: [
          { descricao: "CNPJ", status: "encontrado" },
          { descricao: "sócio ou administrador", status: "encontrado" },
          { descricao: "Instagram oficial", status: "encontrado" },
        ],
        podeEncerrar: true,
        motivo: "Todos os objetivos foram respondidos com valor concreto, evidência e fonte.",
      }),
    );
}

beforeEach(() => {
  clearNeoToolRegistryForTests();
  vi.mocked(callNeoResponses).mockReset();
});

describe("Carango.com.br — cenário obrigatório (CNPJ, sócio/administrador, Instagram)", () => {
  it("resolve os 3 objetivos com a fonte empresarial correta, rejeita a homônima e os posts irrelevantes, e nunca repete a consulta reformulada", async () => {
    const { pesquisarExecute, capturarExecute, extrairExecute } = registerScenarioTools();
    scriptDecisionAndEvaluationCalls();

    const cb = callbacks();
    const budget = createExecutionBudget();
    const { outcome, state } = await runExecutor(
      plan,
      "Informe o CNPJ, o sócio/administrador e o Instagram oficial de carango.com.br.",
      cb,
      { usuarioId: "u1", signal: new AbortController().signal, budget },
    );

    // 1. Three independent, verifiable objectives (never merged into one).
    expect(state.objetivos.map((o) => o.descricao)).toEqual(["CNPJ", "sócio ou administrador", "Instagram oficial"]);
    expect(state.objetivos.every((o) => o.status === "encontrado")).toBe(true);

    // 2. Business-source selection: the CNPJ query ran, and only the official page was ever captured/extracted —
    // never the homonym company.
    expect(pesquisarExecute).toHaveBeenCalledWith(expect.objectContaining({ consulta: "carango.com.br CNPJ" }), expect.anything());
    expect(capturarExecute).toHaveBeenCalledWith(expect.objectContaining({ url: officialBizUrl }), expect.anything());
    expect(capturarExecute).not.toHaveBeenCalledWith(expect.objectContaining({ url: homonymUrl }), expect.anything());
    expect(extrairExecute).not.toHaveBeenCalledWith(expect.objectContaining({ url: homonymUrl }), expect.anything());

    // 3. The link-heavy distractor was captured (imperfect model behavior) but never extracted from.
    expect(capturarExecute).toHaveBeenCalledWith(expect.objectContaining({ url: linkHeavyUrl }), expect.anything());
    expect(extrairExecute).not.toHaveBeenCalledWith(expect.objectContaining({ url: linkHeavyUrl }), expect.anything());

    // 4/5. Structured extraction produced the exact, validated concrete values — not the homonym's data.
    expect(extrairExecute).toHaveBeenCalledWith(expect.objectContaining({ url: officialBizUrl }), expect.anything());
    expect(extrairExecute).toHaveBeenCalledWith(expect.objectContaining({ url: officialInstaUrl }), expect.anything());
    const cnpjFact = state.evidence.find((e) => e.ferramenta === "extrair_dados" && (e.resumo as { json?: { cnpj?: string } })?.json?.cnpj);
    expect((cnpjFact?.resumo as { json: { cnpj: string; responsavel: string } }).json).toEqual({ cnpj: CNPJ, responsavel: RESPONSAVEL });
    const instaFact = state.evidence.find((e) => e.ferramenta === "extrair_dados" && (e.resumo as { json?: { arroba?: string } })?.json?.arroba);
    expect((instaFact?.resumo as { json: { arroba: string } }).json).toEqual({ arroba: ARROBA });

    // 6. Reworded-but-equivalent duplicate ("CNPJ carango.com.br" vs "carango.com.br CNPJ") never re-executed —
    // 13 search results were collected (3 objective queries with noise + 1 catch-all), from only 4 real calls.
    expect(pesquisarExecute).toHaveBeenCalledTimes(4);
    expect(state.fontes.length).toBe(13);
    const dedupEntry = state.evidence.find((e) => (e.resumo as { aviso?: string } | null)?.aviso);
    expect(dedupEntry?.resumo).toMatchObject({ aviso: expect.stringContaining("já executada") });

    // Never surfaces as a rounds/budget failure — this must read as resolved.
    expect(outcome).toEqual({ status: "sem_ferramentas" });

    // ---- Deterministic fallback (used whenever real synthesis can't run): must build a report from the
    // *actual* extracted facts above, never from step names or result/link counts, and must prune `fontes`
    // down to only the sources genuinely behind an extraction — never conflating 13 collected results with
    // "13 sources used".
    const fallback = buildEvidenceFallbackAnswer({
      motivo: "teste",
      etapas: state.evidence,
      fontes: state.fontes,
      objetivos: state.objetivos,
    });
    expect(fallback.status).toBe("parcial");
    expect(JSON.stringify(fallback)).toContain(CNPJ);
    expect(JSON.stringify(fallback)).toContain(RESPONSAVEL);
    expect(JSON.stringify(fallback)).toContain(ARROBA);
    // Never a step name, a result count, or a link count treated as a fact/achado.
    expect(JSON.stringify(fallback.achados)).not.toMatch(/pesquisando|lendo página|extraindo informa|resultado|link/i);
    expect(fallback.matrizEvidencias.every((m) => !/resultado|link encontrado|etapa conclu/i.test(m.evidencia))).toBe(true);
    // Only the two real, extraction-backed sources survive — the homonym, irrelevant posts, the news
    // distractor and the link-heavy directory (never extracted from) are all pruned out.
    expect(fallback.fontes.length).toBe(2);
    expect(fallback.fontes.map((f) => f.url).sort()).toEqual([officialBizUrl, officialInstaUrl].sort());
    // Zero occurrences of the banned term anywhere in the fallback report.
    expect(JSON.stringify(fallback).toLowerCase()).not.toContain("investiga");

    // ---- Full synthesis + visual hierarchy: mocks the model's structured-output call (the real network
    // call is never made in tests) with a realistic, complete report for this exact scenario, then proves
    // synthesizeAnswer's post-processing (banned-term sanitization + fontes pruned to only what's cited)
    // and the approved 9-section visual hierarchy all the way through AnswerView.
    const idFor = (url: string) => assignFonteIds(state.fontes).find((f) => f.url === url)!.id;
    const craftedAnswer: NeoAnswer = {
      version: 2,
      status: "completo",
      titulo: "Carango.com.br: identidade empresarial e presença digital",
      objetivo: "Identificação da empresa responsável pelo domínio, do responsável cadastrado e do perfil oficial nas redes sociais.",
      indicadoresPrincipais: [
        { rotulo: "EMPRESA / CNPJ", valor: `${RAZAO_SOCIAL}.`, descricao: CNPJ, fontesIds: [idFor(officialBizUrl)] },
        { rotulo: "SÓCIO OU ADMINISTRADOR", valor: RESPONSAVEL, descricao: "Relação encontrada: sócio/administrador", fontesIds: [idFor(officialBizUrl)] },
        { rotulo: "INSTAGRAM OFICIAL", valor: ARROBA, descricao: "Perfil relacionado ao domínio analisado", fontesIds: [idFor(officialInstaUrl)] },
      ],
      achados: [
        {
          conclusao: "Empresa responsável identificada",
          // Deliberately contains the banned term — proves sanitizeBannedTerms scrubs model output, not just static strings.
          explicacao: "O domínio foi relacionado à razão social e ao CNPJ apresentados nesta investigação.",
          nivelEvidencia: "confirmado",
          fontesIds: [idFor(officialBizUrl)],
        },
        {
          conclusao: "Responsável cadastrado encontrado",
          explicacao: "A fonte empresarial apresenta o nome e sua função.",
          nivelEvidencia: "confirmado",
          fontesIds: [idFor(officialBizUrl)],
        },
        {
          conclusao: "Perfil oficial relacionado",
          explicacao: "O perfil possui sinais públicos de relação com a marca.",
          nivelEvidencia: "bem_sustentado",
          fontesIds: [idFor(officialInstaUrl)],
        },
      ],
      respostaDireta: `O domínio carango.com.br foi relacionado à empresa ${RAZAO_SOCIAL}, CNPJ ${CNPJ}. ${RESPONSAVEL} aparece publicamente como sócio ou administrador. O perfil social identificado é ${ARROBA}.`,
      blocos: [
        {
          tipo: "entidade",
          nome: RAZAO_SOCIAL,
          subtitulo: `CNPJ ${CNPJ}`,
          descricao: "Empresa responsável pelo domínio carango.com.br.",
          imagemUrl: null,
          identificadores: [{ rotulo: "CNPJ", valor: CNPJ }],
          links: [],
          metricas: [],
          atributos: [{ rotulo: "Situação", valor: "Ativa", tipo: null, nivelEvidencia: "confirmado", dataObservacao: null, fontesIds: [idFor(officialBizUrl)] }],
          fontesIds: [idFor(officialBizUrl)],
        },
        {
          tipo: "pessoa",
          nome: RESPONSAVEL,
          fotoUrl: null,
          papeis: [{ classificacao: "socio", nivelEvidencia: "confirmado", evidencia: "Quadro societário da fonte empresarial oficial.", fontesIds: [idFor(officialBizUrl)] }],
          organizacoesRelacionadas: [{ nome: RAZAO_SOCIAL, relacao: "Sócio/administrador", fontesIds: [idFor(officialBizUrl)] }],
          atributos: [],
          fontesIds: [idFor(officialBizUrl)],
        },
        {
          tipo: "perfil_social",
          nome: "Carango",
          arroba: ARROBA,
          bio: "Loja oficial Carango, peças e acessórios.",
          url: officialInstaUrl,
          fotoUrl: null,
          seguidores: null,
          seguindo: null,
          publicacoes: null,
          relacao: "Perfil oficial relacionado ao domínio analisado.",
          metricaVariavel: false,
          dataObservacao: "2026-07-24",
          fontesIds: [idFor(officialInstaUrl)],
        },
      ],
      lacunas: [],
      matrizEvidencias: [
        { conclusao: "CNPJ da empresa", evidencia: "Página cadastral apresenta razão social e CNPJ.", classificacao: "confirmado" },
        { conclusao: "Sócio ou administrador", evidencia: "Quadro societário informa nome e função.", classificacao: "confirmado" },
        { conclusao: "Perfil oficial do Instagram", evidencia: "Bio e link relacionam o perfil ao domínio pesquisado.", classificacao: "bem_sustentado" },
      ],
      fontes: assignFonteIds(state.fontes),
      observacoes: [],
      proximasAcoes: [],
      perguntaNecessaria: null,
    };

    vi.mocked(callNeoResponses).mockResolvedValueOnce(textResponse(JSON.stringify(craftedAnswer)));
    const synthesized = await synthesizeAnswer({
      userMessage: "Informe o CNPJ, o sócio/administrador e o Instagram oficial de carango.com.br.",
      plan,
      evidence: state.evidence,
      fontesColetadas: state.fontes,
      objetivos: state.objetivos,
    });

    // 17. Banned term never survives, even though the model output above deliberately contained it.
    expect(JSON.stringify(synthesized.answer).toLowerCase()).not.toContain("investiga");
    // 18. 13 collected results never become "13 fontes utilizadas" — only the 2 genuinely cited sources remain
    // (the 3rd card's source, the Instagram profile, is the same fonte as the achado above it).
    expect(synthesized.answer.fontes.length).toBe(2);
    expect(synthesized.answer.fontes.map((f) => f.url).sort()).toEqual([officialBizUrl, officialInstaUrl].sort());

    renderWithQueryClient(<AnswerView mensagemId="m1" answer={synthesized.answer} geradoEm="2026-07-24T18:30:00.000Z" />);

    // 7. Complete report, subject-specific title (never generic), correct badge.
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carango.com.br: identidade empresarial e presença digital" })).toBeInTheDocument();

    // 8. Three executive cards with concrete values — never a tool name, step, or result/link count.
    expect(screen.getByText("EMPRESA / CNPJ")).toBeInTheDocument();
    expect(screen.getByText(`${RAZAO_SOCIAL}.`)).toBeInTheDocument();
    expect(screen.getAllByText(CNPJ).length).toBeGreaterThan(0);
    expect(screen.getByText("SÓCIO OU ADMINISTRADOR")).toBeInTheDocument();
    expect(screen.getAllByText(RESPONSAVEL).length).toBeGreaterThan(0);
    expect(screen.getByText("INSTAGRAM OFICIAL")).toBeInTheDocument();
    expect(screen.getAllByText(ARROBA).length).toBeGreaterThan(0);

    // 9/10. "Principais descobertas" and "Resposta do Neo" side by side.
    expect(screen.getByText("Principais descobertas")).toBeInTheDocument();
    expect(screen.getByText("Empresa responsável identificada")).toBeInTheDocument();
    expect(screen.getByText("Resposta do Neo")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`sócio ou administrador`))).toBeInTheDocument();

    // 11. "Dados da organização" section with the entidade block.
    expect(screen.getByText("Dados da organização")).toBeInTheDocument();
    expect(screen.getAllByText(RAZAO_SOCIAL).length).toBeGreaterThan(0);

    // 12. "Pessoas relacionadas" section — never labels the person "dono" without evidence.
    expect(screen.getByText("Pessoas relacionadas")).toBeInTheDocument();
    expect(screen.getAllByText(RESPONSAVEL).length).toBeGreaterThan(0);
    expect(screen.getByText("Sócio")).toBeInTheDocument();
    expect(screen.queryByText(/\bdono\b/i)).not.toBeInTheDocument();

    // "Presença digital" section with the social profile.
    expect(screen.getByText("Presença digital")).toBeInTheDocument();

    // 13. Evidence matrix with the required, non-technical wording.
    expect(screen.getByText("Como cada conclusão foi sustentada")).toBeInTheDocument();
    expect(screen.getByText("CNPJ da empresa")).toBeInTheDocument();
    expect(screen.getByText("Página cadastral apresenta razão social e CNPJ.")).toBeInTheDocument();

    // 14/18. Sources collapsed, showing the correct pruned count (2, not 13).
    const fontesToggle = screen.getByRole("button", { name: /Ver fontes utilizadas \(2\)/ });
    fireEvent.click(fontesToggle);
    expect(within(fontesToggle.closest("div")!.parentElement!).getByText("empresarial.example")).toBeInTheDocument();

    // 15/16/17. Zero technical steps, zero counts-as-evidence, zero banned term anywhere in the rendered report.
    const rendered = document.body.textContent ?? "";
    expect(rendered).not.toMatch(/pesquisando fontes|lendo página|extraindo informa/i);
    expect(rendered).not.toMatch(/\d+\s+resultados?\s+encontrados?/i);
    expect(rendered).not.toMatch(/\d+\s+links?\s+encontrados?/i);
    expect(rendered.toLowerCase()).not.toContain("investiga");
  });
});
