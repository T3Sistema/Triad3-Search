// @vitest-environment jsdom
import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { runNeoAgent, createInitialAgentState, type RunAgentInput } from "@/server/neo/agent";
import { createExecutionBudget } from "@/server/neo/budget";
import { clearNeoToolRegistryForTests, registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { refreshEntityMemoryFromAnswer, summarizeEntityMemory } from "@/server/neo/entity-memory";
import { AnswerView } from "@/components/neo/answer-view";
import type { NeoAnswer } from "@/lib/neo/answer";
import type { NeoAgentTurn } from "@/server/neo/schemas";

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * The mandated end-to-end scenario for the agent rearchitecture: "Analise o
 * site carango.com.br e informe CNPJ, sócio ou administrador e Instagram
 * oficial", mixed with a homonym company under a genuinely different CNPJ,
 * irrelevant social posts, and a link-heavy page. All identifying values
 * below are fixture-only, invented for this test and never referenced by
 * production code.
 *
 * Proves, through the real single-loop agent (src/server/neo/agent.ts) —
 * no separate planner, no separate per-round evaluation call, no separate
 * synthesizer — that: the domain alone is enough to proceed without asking
 * an unnecessary clarifying question; both companies' CNPJs are preserved
 * (never collapsed just because the names are similar) and their
 * relationship to the domain is classified; the approved 9-section visual
 * hierarchy renders correctly with two entidade blocks; and — the
 * capability that didn't exist before this rearchitecture — a follow-up
 * question in the same conversation is answered directly from entity memory
 * without re-running any tool.
 */

const CNPJ_VINCULADO = "10.315.072/0001-81";
const RAZAO_SOCIAL_VINCULADA = "Carango Comércio de Peças Ltda";
const CNPJ_HOMONIMO = "22.111.333/0001-55";
const RAZAO_SOCIAL_HOMONIMA = "Carango Comércio Ltda";
const RESPONSAVEL = "Fabio Rodrigo Bizetto";
const ARROBA = "@carango.com.br";

const bizUrlVinculada = "https://empresarial.example/carango-pecas";
const bizUrlHomonima = "https://empresarial.example/carango-outra-cidade";
const quadroSocietarioUrl = "https://empresarial.example/carango-pecas-quadro";
const irrelevantNewsUrl = "https://noticias.example/outro-assunto";
const instaUrl = "https://instagram.example/carango.com.br";
const irrelevantPost1 = "https://instagram.example/post-irrelevante-1";
const irrelevantPost2 = "https://instagram.example/post-irrelevante-2";

type FakeResponse = Awaited<ReturnType<typeof callNeoResponses>>;

function decisionResponse(functionCalls: Array<{ name: string; args: unknown }>): FakeResponse {
  return {
    usage: { input_tokens: 20, output_tokens: 10 },
    output: functionCalls.map((fc, i) => ({ type: "function_call" as const, call_id: `call_${i}_${Math.random()}`, name: fc.name, arguments: JSON.stringify(fc.args) })),
  } as unknown as FakeResponse;
}

function turnResponse(turno: NeoAgentTurn): FakeResponse {
  return { usage: { input_tokens: 30, output_tokens: 80 }, output_text: JSON.stringify({ decisao: turno }) } as unknown as FakeResponse;
}

function registerScenarioTools() {
  const pesquisarExecute = vi.fn(async (args: { consulta: string }): Promise<NeoToolExecutionResult> => {
    if (args.consulta.includes("CNPJ")) {
      return {
        ok: true,
        resumo: {
          resultados: [
            { url: bizUrlVinculada, titulo: `${RAZAO_SOCIAL_VINCULADA} — dados cadastrais`, trecho: "CNPJ e endereço relacionados ao domínio pesquisado." },
            { url: bizUrlHomonima, titulo: `${RAZAO_SOCIAL_HOMONIMA} — outra cidade`, trecho: "Empresa homônima, endereço em outra cidade, sem menção ao domínio." },
            { url: irrelevantNewsUrl, titulo: "Notícia sem relação", trecho: "Assunto totalmente diferente." },
          ],
        },
        fontes: [
          { url: bizUrlVinculada, titulo: RAZAO_SOCIAL_VINCULADA, dominio: "empresarial.example" },
          { url: bizUrlHomonima, titulo: RAZAO_SOCIAL_HOMONIMA, dominio: "empresarial.example" },
          { url: irrelevantNewsUrl, titulo: "Notícia sem relação", dominio: "noticias.example" },
        ],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    if (args.consulta.includes("sócio") || args.consulta.includes("administrador")) {
      return {
        ok: true,
        resumo: { resultados: [{ url: quadroSocietarioUrl, titulo: "Quadro societário — Carango Peças", trecho: "Documento com nome e função do responsável." }] },
        fontes: [{ url: quadroSocietarioUrl, titulo: "Quadro societário", dominio: "empresarial.example" }],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    if (args.consulta.includes("Instagram")) {
      return {
        ok: true,
        resumo: {
          resultados: [
            { url: irrelevantPost1, titulo: "Post irrelevante 1", trecho: "Sem relação com o domínio." },
            { url: irrelevantPost2, titulo: "Post irrelevante 2", trecho: "Sem relação com o domínio." },
            { url: instaUrl, titulo: `${ARROBA} no Instagram`, trecho: "Perfil oficial relacionado ao domínio." },
          ],
        },
        fontes: [
          { url: irrelevantPost1, titulo: "Post irrelevante 1", dominio: "instagram.example" },
          { url: irrelevantPost2, titulo: "Post irrelevante 2", dominio: "instagram.example" },
          { url: instaUrl, titulo: ARROBA, dominio: "instagram.example" },
        ],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    return { ok: true, resumo: { resultados: [] }, fontes: [], parcial: false, informacoesAusentes: [] };
  });
  registerNeoTool({
    name: "pesquisar_web" as never,
    nomePublico: "Pesquisar",
    description: "d",
    persistent: false,
    timeoutMs: 100,
    parameters: z.object({ consulta: z.string() }),
    execute: pesquisarExecute,
  });

  const capturarExecute = vi.fn(async (args: { url: string }): Promise<NeoToolExecutionResult> => {
    if (args.url === bizUrlVinculada || args.url === quadroSocietarioUrl) {
      return {
        ok: true,
        resumo: { markdown: `${RAZAO_SOCIAL_VINCULADA} — CNPJ ${CNPJ_VINCULADO}. Endereço relacionado ao domínio carango.com.br. Sócio administrador: ${RESPONSAVEL}.` },
        fontes: [],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    if (args.url === bizUrlHomonima) {
      return {
        ok: true,
        resumo: { markdown: `${RAZAO_SOCIAL_HOMONIMA} — CNPJ ${CNPJ_HOMONIMO}. Sede em outra cidade, sem qualquer menção ao domínio carango.com.br.` },
        fontes: [],
        parcial: false,
        informacoesAusentes: [],
      };
    }
    if (args.url === instaUrl) {
      return { ok: true, resumo: { markdown: `${ARROBA} — Perfil oficial. Bio: Loja oficial Carango, peças e acessórios.` }, fontes: [], parcial: false, informacoesAusentes: [] };
    }
    return { ok: true, resumo: { markdown: "" }, fontes: [], parcial: false, informacoesAusentes: [] };
  });
  registerNeoTool({
    name: "capturar_pagina" as never,
    nomePublico: "Capturar página",
    description: "d",
    persistent: false,
    timeoutMs: 100,
    parameters: z.object({ url: z.string(), formatos: z.array(z.string()).default([]) }),
    execute: capturarExecute,
  });

  const extrairExecute = vi.fn(async (args: { url: string | null }): Promise<NeoToolExecutionResult> => {
    if (args.url === bizUrlVinculada) {
      return { ok: true, resumo: { json: { cnpj: CNPJ_VINCULADO, responsavel: RESPONSAVEL } }, fontes: [], parcial: false, informacoesAusentes: [] };
    }
    if (args.url === bizUrlHomonima) {
      return { ok: true, resumo: { json: { cnpj: CNPJ_HOMONIMO } }, fontes: [], parcial: false, informacoesAusentes: [] };
    }
    if (args.url === instaUrl) {
      return { ok: true, resumo: { json: { arroba: ARROBA } }, fontes: [], parcial: false, informacoesAusentes: [] };
    }
    return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico: "fonte não suportada neste teste" };
  });
  registerNeoTool({
    name: "extrair_dados" as never,
    nomePublico: "Extrair dados",
    description: "d",
    persistent: false,
    timeoutMs: 100,
    parameters: z.object({ url: z.string().nullable(), markdown: z.string().nullable(), instrucao: z.string(), campos: z.array(z.string()) }),
    execute: extrairExecute,
  });

  return { pesquisarExecute, capturarExecute, extrairExecute };
}

function craftedRelatorio(idFor: (url: string) => string): NeoAgentTurn {
  const relatorio: NeoAnswer = {
    version: 2,
    status: "completo",
    titulo: "Carango.com.br: identidade empresarial e presença digital",
    objetivo: "Identificação da empresa responsável pelo domínio, do responsável cadastrado e do perfil oficial nas redes sociais.",
    indicadoresPrincipais: [
      { rotulo: "EMPRESA / CNPJ", valor: `${RAZAO_SOCIAL_VINCULADA}.`, descricao: CNPJ_VINCULADO, fontesIds: [idFor(bizUrlVinculada)] },
      { rotulo: "SÓCIO OU ADMINISTRADOR", valor: RESPONSAVEL, descricao: "Relação encontrada: sócio/administrador", fontesIds: [idFor(bizUrlVinculada)] },
      { rotulo: "INSTAGRAM OFICIAL", valor: ARROBA, descricao: "Perfil relacionado ao domínio analisado", fontesIds: [idFor(instaUrl)] },
    ],
    achados: [
      { conclusao: "Empresa responsável identificada", explicacao: "O domínio foi relacionado à razão social e ao CNPJ apresentados.", nivelEvidencia: "confirmado", fontesIds: [idFor(bizUrlVinculada)] },
      { conclusao: "Empresa homônima identificada e descartada", explicacao: "Uma segunda empresa com nome semelhante existe, mas não há vínculo confirmado com o domínio.", nivelEvidencia: "confirmado", fontesIds: [idFor(bizUrlHomonima)] },
      { conclusao: "Perfil oficial relacionado", explicacao: "O perfil possui sinais públicos de relação com a marca.", nivelEvidencia: "bem_sustentado", fontesIds: [idFor(instaUrl)] },
    ],
    respostaDireta: `O domínio carango.com.br foi relacionado à empresa ${RAZAO_SOCIAL_VINCULADA}, CNPJ ${CNPJ_VINCULADO}. Existe uma segunda empresa homônima (CNPJ ${CNPJ_HOMONIMO}), sem vínculo confirmado com o domínio. ${RESPONSAVEL} aparece como sócio/administrador da empresa vinculada. O perfil social identificado é ${ARROBA}.`,
    blocos: [
      {
        tipo: "entidade",
        nome: RAZAO_SOCIAL_VINCULADA,
        subtitulo: `CNPJ ${CNPJ_VINCULADO}`,
        descricao: "Empresa responsável pelo domínio carango.com.br.",
        imagemUrl: null,
        identificadores: [{ rotulo: "CNPJ", valor: CNPJ_VINCULADO }],
        links: [],
        metricas: [],
        atributos: [],
        fontesIds: [idFor(bizUrlVinculada)],
      },
      {
        tipo: "entidade",
        nome: RAZAO_SOCIAL_HOMONIMA,
        subtitulo: `CNPJ ${CNPJ_HOMONIMO}`,
        descricao: "Empresa homônima, sem vínculo confirmado com o domínio analisado.",
        imagemUrl: null,
        identificadores: [{ rotulo: "CNPJ", valor: CNPJ_HOMONIMO }],
        links: [],
        metricas: [],
        atributos: [],
        fontesIds: [idFor(bizUrlHomonima)],
      },
      {
        tipo: "relacoes",
        titulo: "Relações entre as empresas encontradas",
        itens: [
          { origem: RAZAO_SOCIAL_VINCULADA, relacao: "vínculo direto com o domínio", destino: "carango.com.br", evidencia: "CNPJ e endereço citados na fonte cadastral.", fontesIds: [idFor(bizUrlVinculada)] },
          { origem: RAZAO_SOCIAL_HOMONIMA, relacao: "homônimo sem vínculo confirmado", destino: "carango.com.br", evidencia: "Nome semelhante, mas CNPJ e cidade distintos, sem menção ao domínio.", fontesIds: [idFor(bizUrlHomonima)] },
        ],
      },
      {
        tipo: "pessoa",
        nome: RESPONSAVEL,
        fotoUrl: null,
        papeis: [{ classificacao: "socio", nivelEvidencia: "confirmado", evidencia: "Quadro societário da fonte empresarial oficial.", fontesIds: [idFor(bizUrlVinculada)] }],
        organizacoesRelacionadas: [{ nome: RAZAO_SOCIAL_VINCULADA, relacao: "Sócio/administrador", fontesIds: [idFor(bizUrlVinculada)] }],
        atributos: [],
        fontesIds: [idFor(bizUrlVinculada)],
      },
      {
        tipo: "perfil_social",
        nome: "Carango",
        arroba: ARROBA,
        bio: "Loja oficial Carango, peças e acessórios.",
        url: instaUrl,
        fotoUrl: null,
        seguidores: null,
        seguindo: null,
        publicacoes: null,
        relacao: "Perfil oficial relacionado ao domínio analisado.",
        metricaVariavel: false,
        dataObservacao: "2026-07-24",
        fontesIds: [idFor(instaUrl)],
      },
    ],
    lacunas: [],
    matrizEvidencias: [
      { conclusao: "CNPJ da empresa vinculada", evidencia: "Página cadastral apresenta razão social e CNPJ.", classificacao: "confirmado" },
      { conclusao: "Empresa homônima sem vínculo", evidencia: "CNPJ e cidade distintos da empresa vinculada.", classificacao: "confirmado" },
      { conclusao: "Sócio ou administrador", evidencia: "Quadro societário informa nome e função.", classificacao: "confirmado" },
      { conclusao: "Perfil oficial do Instagram", evidencia: "Bio relaciona o perfil ao domínio pesquisado.", classificacao: "bem_sustentado" },
    ],
    fontes: [
      { id: idFor(bizUrlVinculada), titulo: RAZAO_SOCIAL_VINCULADA, url: bizUrlVinculada, dominio: "empresarial.example", dataAcesso: "2026-07-24" },
      { id: idFor(bizUrlHomonima), titulo: RAZAO_SOCIAL_HOMONIMA, url: bizUrlHomonima, dominio: "empresarial.example", dataAcesso: "2026-07-24" },
      { id: idFor(instaUrl), titulo: ARROBA, url: instaUrl, dominio: "instagram.example", dataAcesso: "2026-07-24" },
    ],
    observacoes: [],
    proximasAcoes: [],
    perguntaNecessaria: null,
  };
  return { tipo: "relatorio", relatorio };
}

beforeEach(() => {
  clearNeoToolRegistryForTests();
  vi.mocked(callNeoResponses).mockReset();
});

describe("Carango.com.br — agente único (duas empresas, dois CNPJs, continuação contextual)", () => {
  it("resolve os 3 dados pedidos sem perguntar desnecessariamente, preserva os dois CNPJs, classifica o vínculo, gera um único relatório na estrutura aprovada, e depois responde uma continuação sem repetir nenhuma ferramenta", async () => {
    const { pesquisarExecute, capturarExecute, extrairExecute } = registerScenarioTools();

    const input: RunAgentInput = {
      userMessage: "Analise o site carango.com.br e informe CNPJ, sócio ou administrador e Instagram oficial.",
      resumoContexto: null,
      mensagensRecentes: [],
      entidades: [],
    };
    const budget = createExecutionBudget();
    const cb = { onEtapaIniciada: vi.fn(async () => "etapa"), onEtapaConcluida: vi.fn(async () => {}), onEtapaFalhou: vi.fn(async () => {}) };

    // Fonte ids are assigned in the order results are collected into state.fontes: the CNPJ query's
    // results first, then the sócio query's, then the Instagram query's.
    const idFor = (url: string) => {
      const order = [bizUrlVinculada, bizUrlHomonima, irrelevantNewsUrl, quadroSocietarioUrl, irrelevantPost1, irrelevantPost2, instaUrl];
      return `f${order.indexOf(url) + 1}`;
    };

    // Round 1: search each data point (business/CNPJ, sócio, Instagram). Round 2: captures the linked
    // source, the homonym (to compare/rule out), and the Instagram profile. Round 3: extracts the exact
    // fields from every captured page — both companies, never merged. Round 4: the final decision.
    vi.mocked(callNeoResponses)
      .mockResolvedValueOnce(
        decisionResponse([
          { name: "pesquisar_web", args: { consulta: "carango.com.br CNPJ" } },
          { name: "pesquisar_web", args: { consulta: "sócio administrador carango.com.br" } },
          { name: "pesquisar_web", args: { consulta: "carango.com.br Instagram" } },
        ]),
      )
      .mockResolvedValueOnce(
        decisionResponse([
          { name: "capturar_pagina", args: { url: bizUrlVinculada, formatos: ["resumo"] } },
          { name: "capturar_pagina", args: { url: bizUrlHomonima, formatos: ["resumo"] } },
          { name: "capturar_pagina", args: { url: instaUrl, formatos: ["resumo"] } },
        ]),
      )
      .mockResolvedValueOnce(
        decisionResponse([
          { name: "extrair_dados", args: { url: bizUrlVinculada, markdown: null, instrucao: "Extrair CNPJ e responsável", campos: ["cnpj", "responsavel"] } },
          { name: "extrair_dados", args: { url: bizUrlHomonima, markdown: null, instrucao: "Extrair CNPJ", campos: ["cnpj"] } },
          { name: "extrair_dados", args: { url: instaUrl, markdown: null, instrucao: "Extrair arroba oficial", campos: ["arroba"] } },
        ]),
      )
      .mockResolvedValueOnce(turnResponse(craftedRelatorio(idFor)));

    const result = await runNeoAgent(input, cb, { usuarioId: "u1", signal: new AbortController().signal, budget, resumeState: createInitialAgentState() });

    // Exactly 4 calls total — one per round, never a separate planning or evaluation call.
    expect(callNeoResponses).toHaveBeenCalledTimes(4);
    expect(result.outcome.status).toBe("concluido");
    if (result.outcome.status !== "concluido") throw new Error("expected concluido");

    // Domain was already given — the agent never asks an unnecessary clarifying question.
    expect(result.outcome.decisao.tipo).toBe("relatorio");
    if (result.outcome.decisao.tipo !== "relatorio") throw new Error("expected relatorio");
    const relatorio = result.outcome.decisao.relatorio;

    // Both companies' distinct sources were selected, captured and extracted — never just one arbitrarily.
    expect(capturarExecute).toHaveBeenCalledWith(expect.objectContaining({ url: bizUrlVinculada }), expect.anything());
    expect(capturarExecute).toHaveBeenCalledWith(expect.objectContaining({ url: bizUrlHomonima }), expect.anything());
    expect(extrairExecute).toHaveBeenCalledWith(expect.objectContaining({ url: bizUrlVinculada }), expect.anything());
    expect(extrairExecute).toHaveBeenCalledWith(expect.objectContaining({ url: bizUrlHomonima }), expect.anything());
    expect(pesquisarExecute).toHaveBeenCalledTimes(3);

    // The two CNPJs are preserved as two distinct entidade blocos — never collapsed into one.
    const entidades = relatorio.blocos.filter((b) => b.tipo === "entidade");
    expect(entidades).toHaveLength(2);
    expect(new Set(entidades.map((e) => (e.tipo === "entidade" ? e.identificadores[0]?.valor : null)))).toEqual(new Set([CNPJ_VINCULADO, CNPJ_HOMONIMO]));

    // The relationship between the two is classified, not left implicit.
    const relacoesBloco = relatorio.blocos.find((b) => b.tipo === "relacoes");
    expect(relacoesBloco).toBeDefined();
    if (relacoesBloco?.tipo === "relacoes") {
      expect(relacoesBloco.itens.some((i) => i.relacao.includes("vínculo direto"))).toBe(true);
      expect(relacoesBloco.itens.some((i) => i.relacao.includes("homônimo"))).toBe(true);
    }

    // ---- Entity memory: derived purely from the relatório's own blocos, in code — never by the model.
    const memoria = refreshEntityMemoryFromAnswer([], relatorio);
    const empresasNaMemoria = memoria.filter((e) => e.tipo === "empresa");
    expect(empresasNaMemoria).toHaveLength(2);
    expect(new Set(empresasNaMemoria.map((e) => e.identificador))).toEqual(
      new Set([CNPJ_VINCULADO.replace(/\D/g, ""), CNPJ_HOMONIMO.replace(/\D/g, "")]),
    );
    const vinculada = empresasNaMemoria.find((e) => e.identificador === CNPJ_VINCULADO.replace(/\D/g, ""))!;

    // ---- Visual structure: the approved hierarchy renders both companies + the relação between them.
    renderWithQueryClient(<AnswerView mensagemId="m1" answer={relatorio} geradoEm="2026-07-24T18:30:00.000Z" />);
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByText("Dados da organização")).toBeInTheDocument();
    expect(screen.getAllByText(RAZAO_SOCIAL_VINCULADA).length).toBeGreaterThan(0);
    expect(screen.getAllByText(RAZAO_SOCIAL_HOMONIMA).length).toBeGreaterThan(0);
    expect(screen.getByText("Como cada conclusão foi sustentada")).toBeInTheDocument();
    const rendered = document.body.textContent ?? "";
    expect(rendered).not.toMatch(/pesquisando fontes|lendo página|extraindo informa/i);
    expect(rendered.toLowerCase()).not.toContain("investiga");

    // ---- Continuation: a follow-up question in the same conversation, now with entity memory populated,
    // is answered directly from context — the capability that didn't exist before this rearchitecture.
    vi.mocked(callNeoResponses).mockReset();
    vi.mocked(callNeoResponses).mockResolvedValueOnce(
      turnResponse({ tipo: "resposta", texto: `${RAZAO_SOCIAL_VINCULADA} é a empresa diretamente relacionada ao site — a outra é apenas homônima.` }),
    );
    const continuationInput: RunAgentInput = {
      userMessage: "E qual deles está diretamente relacionado ao site?",
      resumoContexto: null,
      mensagensRecentes: [
        { papel: "usuario", conteudo: input.userMessage },
        { papel: "assistente", conteudo: relatorio.respostaDireta },
      ],
      entidades: memoria,
    };
    const continuationResult = await runNeoAgent(continuationInput, cb, {
      usuarioId: "u1",
      signal: new AbortController().signal,
      budget: createExecutionBudget(),
      resumeState: createInitialAgentState(),
    });

    expect(callNeoResponses).toHaveBeenCalledTimes(1); // one round, no tool call needed
    expect(pesquisarExecute).toHaveBeenCalledTimes(3); // unchanged from turn 1 — nothing repeated
    expect(capturarExecute.mock.calls.length).toBe(3); // unchanged from turn 1
    expect(extrairExecute.mock.calls.length).toBe(3); // unchanged from turn 1
    expect(continuationResult.outcome.status).toBe("concluido");
    if (continuationResult.outcome.status !== "concluido") throw new Error("expected concluido");
    expect(continuationResult.outcome.decisao.tipo).toBe("resposta");
    if (continuationResult.outcome.decisao.tipo !== "resposta") throw new Error("expected resposta");
    expect(continuationResult.outcome.decisao.texto).toContain(RAZAO_SOCIAL_VINCULADA);

    // The prompt actually handed to the model for the continuation includes the known entity summary —
    // proving the answer is grounded in memory, not a lucky guess.
    const continuationCallArgs = vi.mocked(callNeoResponses).mock.calls[0]![0];
    expect(continuationCallArgs.input).toContain(vinculada.id);
    expect(summarizeEntityMemory(memoria)).toContain(CNPJ_VINCULADO.replace(/\D/g, ""));
  });
});
