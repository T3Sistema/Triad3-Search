import "server-only";
import { NEO_ANSWER_VERSION, pruneUnusedFontes, type NeoAchado, type NeoAnswer, type NeoFato, type NeoFonte } from "@/lib/neo/answer";
import { sanitizeBannedTerms } from "@/lib/neo/sanitize-terms";
import type { NeoObjetivo } from "@/server/neo/schemas";

/**
 * Deterministic, non-LLM report builder. Used whenever a real synthesis call
 * either can't be attempted (no time left in the budget's synthesis reserve)
 * or fails/times out — and by server-side reconciliation
 * (src/server/neo/reconciliation.ts) for executions whose process died
 * before any synthesis ever ran.
 *
 * Never treats a tool/step name, a result count, or a link count as a fact —
 * those are operational metadata, not evidence. The only material this
 * builder is allowed to use is a *structured* extraction result
 * (`extrair_dados`'s own `resumo.json`): a real, concrete value with a
 * traceable origin. When no extraction produced anything concrete, the
 * report is "nao_concluido" — never a fabricated "parcial" report built out
 * of step metadata.
 */

export interface FallbackEtapaLike {
  /** Internal tool name (e.g. "extrair_dados") — used to identify structured extractions. Never shown to the user. */
  ferramenta: string;
  /** Friendly display name — kept for compatibility with callers, but never used as report content anymore. */
  nomePublico: string;
  ok: boolean;
  resumo?: unknown;
  erroPublico?: string | null;
  /** Original tool call arguments, when available — used only to associate an extraction with the source URL it came from. */
  argumentos?: Record<string, unknown> | null;
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

/**
 * Short, human-readable pt-BR summary of a normalized tool result — used
 * only by the live SSE progress panel (etapas-list.tsx) while an analysis is
 * running. Operational metadata like this must never be treated as a report
 * fact — see buildEvidenceFallbackAnswer below, which never calls this.
 */
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

const KNOWN_ABBREVIATIONS: Record<string, string> = {
  cnpj: "CNPJ",
  cpf: "CPF",
  cep: "CEP",
  cnae: "CNAE",
  ie: "Inscrição estadual",
  url: "URL",
};

/** Turns a generic extracted field key ("razao_social", "nomeFantasia") into a readable pt-BR label — no domain-specific hardcoding. */
function humanizeKey(key: string): string {
  const withSeparators = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  const words = withSeparators.split(/[_\s-]+/).filter(Boolean);
  return words
    .map((word, i) => {
      if (KNOWN_ABBREVIATIONS[word]) return KNOWN_ABBREVIATIONS[word];
      return i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}

function stringifyValue(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  try {
    const serialized = JSON.stringify(valor);
    return serialized === "{}" || serialized === "[]" ? "" : serialized;
  } catch {
    return "";
  }
}

/** Extracts the structured `{json: {...}}` payload from an `extrair_dados` evidence entry, when present and not truncated. */
function extractJson(resumo: unknown): Record<string, unknown> | null {
  if (!resumo || typeof resumo !== "object") return null;
  const json = (resumo as Record<string, unknown>).json;
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

interface ExtractedFact {
  fato: NeoFato;
  origemUrl: string | null;
}

/** Flattens every successful extrair_dados evidence entry into concrete, sourced facts — the only material this fallback may present as findings. */
function collectExtractedFacts(etapas: FallbackEtapaLike[]): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  for (const etapa of etapas) {
    if (!etapa.ok || etapa.ferramenta !== "extrair_dados") continue;
    const json = extractJson(etapa.resumo);
    if (!json) continue;
    const origemUrl = typeof etapa.argumentos?.url === "string" ? etapa.argumentos.url : null;
    for (const [chave, valorBruto] of Object.entries(json)) {
      const valor = stringifyValue(valorBruto);
      if (!valor) continue;
      facts.push({
        fato: {
          rotulo: humanizeKey(chave),
          valor,
          tipo: null,
          nivelEvidencia: "bem_sustentado",
          dataObservacao: null,
          fontesIds: [],
        },
        origemUrl,
      });
    }
  }
  return facts;
}

export function buildEvidenceFallbackAnswer(params: {
  /** Server-side reason this fallback ran — logged, and used only to build a neutral respostaDireta; never surfaces tool/step details. */
  motivo: string;
  etapas: FallbackEtapaLike[];
  fontes: FallbackFonteLike[];
  /** Final tracked objective state from the executor, when available — drives lacunas without naming any tool. */
  objetivos?: NeoObjetivo[];
}): NeoAnswer {
  const objetivos = params.objetivos ?? [];
  const extractedFacts = collectExtractedFacts(params.etapas);

  const allFontes = assignFallbackFonteIds(params.fontes);
  const fonteIdByUrl = new Map(allFontes.map((f) => [f.url, f.id]));

  const lacunasDeObjetivos = objetivos
    .filter((o) => o.status !== "encontrado")
    .map((o) => ({ tipo: "nao_encontrado" as const, descricao: o.descricao }));

  if (extractedFacts.length === 0) {
    const answer: NeoAnswer = {
      version: NEO_ANSWER_VERSION,
      status: "nao_concluido",
      titulo: "Não foi possível confirmar os dados solicitados",
      objetivo: "",
      indicadoresPrincipais: [],
      achados: [],
      respostaDireta: "Os resultados localizados não apresentaram evidências suficientes. Você pode ajustar a solicitação ou tentar novamente.",
      blocos: [],
      lacunas: lacunasDeObjetivos,
      matrizEvidencias: [],
      fontes: [],
      observacoes: [],
      proximasAcoes: [],
      perguntaNecessaria: null,
    };
    return sanitizeBannedTerms(answer);
  }

  const fatos = extractedFacts.map((f) => f.fato);
  const indicadoresPrincipais: NeoAnswer["indicadoresPrincipais"] = extractedFacts.slice(0, 3).map(({ fato, origemUrl }) => ({
    rotulo: fato.rotulo,
    valor: fato.valor,
    descricao: null,
    fontesIds: origemUrl && fonteIdByUrl.has(origemUrl) ? [fonteIdByUrl.get(origemUrl)!] : [],
  }));

  const achados: NeoAchado[] = extractedFacts.map(({ fato, origemUrl }) => ({
    conclusao: `${fato.rotulo}: ${fato.valor}`,
    explicacao: "Valor extraído de uma fonte consultada.",
    nivelEvidencia: fato.nivelEvidencia,
    fontesIds: origemUrl && fonteIdByUrl.has(origemUrl) ? [fonteIdByUrl.get(origemUrl)!] : [],
  }));

  const matrizEvidencias: NeoAnswer["matrizEvidencias"] = extractedFacts.map(({ fato }) => ({
    conclusao: `${fato.rotulo}: ${fato.valor}`,
    evidencia: "Extraído do conteúdo de uma fonte consultada.",
    classificacao: "bem_sustentado",
  }));

  const blocos: NeoAnswer["blocos"] = [
    {
      tipo: "fatos",
      titulo: "Dados encontrados",
      itens: fatos,
    },
  ];

  const respostaDireta = `Foram confirmados os seguintes dados: ${fatos.map((f) => `${f.rotulo}: ${f.valor}`).join("; ")}.`;

  const answer: NeoAnswer = {
    version: NEO_ANSWER_VERSION,
    status: "parcial",
    titulo: fatos[0] ? `Dados confirmados: ${fatos.map((f) => f.rotulo).join(", ")}` : "Relatório parcial",
    objetivo: "",
    indicadoresPrincipais,
    achados,
    respostaDireta,
    blocos,
    lacunas: lacunasDeObjetivos,
    matrizEvidencias,
    fontes: allFontes,
    observacoes: [],
    proximasAcoes: lacunasDeObjetivos.length > 0 ? ["Continue esta análise para tentar confirmar os dados restantes."] : [],
    perguntaNecessaria: null,
  };

  return sanitizeBannedTerms(pruneUnusedFontes(answer));
}

/** Whether there is anything at all worth showing the user — otherwise a plain failure message is clearer than an empty report. */
export function hasFallbackEvidence(etapas: FallbackEtapaLike[], fontes: FallbackFonteLike[]): boolean {
  return etapas.some((e) => e.ok) || fontes.length > 0;
}
