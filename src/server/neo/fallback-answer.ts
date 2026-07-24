import "server-only";
import { NEO_ANSWER_VERSION, type NeoAnswer, type NeoFonte } from "@/lib/neo/answer";

/**
 * Deterministic, non-LLM report builder. Used whenever a real synthesis call
 * either can't be attempted (no time left in the budget's synthesis reserve)
 * or fails/times out — and by server-side reconciliation
 * (src/server/neo/reconciliation.ts) for executions whose process died
 * before any synthesis ever ran. Never invents data: every fact comes
 * straight from a persisted tool result or source, so it works from either
 * the live in-memory executor state or rows read back from the database.
 */

export interface FallbackEtapaLike {
  nomePublico: string;
  ok: boolean;
  resumo?: unknown;
  erroPublico?: string | null;
}

export interface FallbackFonteLike {
  url: string;
  titulo?: string | null;
  dominio?: string | null;
  dataObservacao?: string | null;
}

const RESUMO_ARRAY_KEYS: Array<[string, string]> = [
  ["resultados", "resultado(s) encontrado(s)"],
  ["itens", "item(ns) encontrado(s)"],
  ["paginas", "página(s) processada(s)"],
  ["links", "link(s) encontrado(s)"],
  ["imagens", "imagem(ns) encontrada(s)"],
];

/** Short, human-readable pt-BR summary of a normalized tool result — shared by the live SSE progress panel and the fallback report. */
export function summarizeToolResult(resumo: unknown): string {
  const record = resumo as Record<string, unknown> | null;
  if (record) {
    for (const [key, label] of RESUMO_ARRAY_KEYS) {
      const value = record[key];
      if (Array.isArray(value)) return `${value.length} ${label}.`;
    }
  }
  return "Etapa concluída.";
}

function assignFallbackFonteIds(fontes: FallbackFonteLike[]): NeoFonte[] {
  return fontes.map((f, i) => ({
    id: `f${i + 1}`,
    titulo: f.titulo ?? null,
    url: f.url,
    dominio: f.dominio ?? null,
    dataAcesso: f.dataObservacao ?? null,
  }));
}

export function buildEvidenceFallbackAnswer(params: {
  motivo: string;
  etapas: FallbackEtapaLike[];
  fontes: FallbackFonteLike[];
}): NeoAnswer {
  const concluidas = params.etapas.filter((e) => e.ok);
  const falhadas = params.etapas.filter((e) => !e.ok);
  const fontes = assignFallbackFonteIds(params.fontes);

  const blocos: NeoAnswer["blocos"] = [
    { tipo: "texto", titulo: "O que aconteceu", conteudo: params.motivo, fontesIds: [] },
  ];

  if (concluidas.length > 0) {
    blocos.push({
      tipo: "fatos",
      titulo: "Etapas concluídas",
      itens: concluidas.map((e) => ({
        rotulo: e.nomePublico,
        valor: summarizeToolResult(e.resumo),
        tipo: null,
        nivelEvidencia: "indicio" as const,
        dataObservacao: null,
        fontesIds: [],
      })),
    });
  }

  if (fontes.length > 0) {
    blocos.push({ tipo: "fontes", itens: fontes });
  }

  const resumoExecutivo =
    concluidas.length > 0
      ? `${params.motivo} ${concluidas.length} etapa(s) foram concluídas antes da interrupção.`
      : params.motivo;

  return {
    version: NEO_ANSWER_VERSION,
    status: "parcial",
    titulo: "Investigação interrompida",
    resumoExecutivo,
    blocos,
    fontes,
    informacoesAusentes: falhadas.map((e) => `${e.nomePublico}: ${e.erroPublico ?? "não foi concluído"}`),
    observacoes: ["Este relatório foi montado automaticamente a partir das etapas já concluídas, sem uma síntese final do modelo."],
    proximasAcoes: concluidas.length > 0 ? ["Continue esta investigação para tentar concluir o relatório completo."] : [],
    perguntaNecessaria: null,
  };
}

/** Whether there is anything at all worth showing the user — otherwise a plain failure message is clearer than an empty report. */
export function hasFallbackEvidence(etapas: FallbackEtapaLike[], fontes: FallbackFonteLike[]): boolean {
  return etapas.some((e) => e.ok) || fontes.length > 0;
}
