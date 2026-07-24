import { z } from "zod";

/**
 * NeoAnswer — the versioned, structured shape of every Neo investigation
 * report. Shared between server (Structured Outputs schema + post-validation
 * in src/server/neo/synthesizer.ts) and client (rendering in
 * src/components/neo/). No secrets, no vendor names, no branding — safe for
 * the browser bundle, same rule as src/lib/integration/schemas.ts.
 *
 * Every field the model must fill is required; anything that can be absent
 * uses `.nullable()` (never `.optional()`) so the JSON Schema stays strict
 * — see node_modules/openai/helpers/zod.js `toStrictJsonSchema`.
 */

export const NEO_ANSWER_VERSION = 1 as const;

export const NEO_ANSWER_STATUS = ["completo", "parcial", "precisa_de_informacao"] as const;
export type NeoAnswerStatus = (typeof NEO_ANSWER_STATUS)[number];

export const NEO_NIVEL_EVIDENCIA = [
  "confirmado",
  "bem_sustentado",
  "indicio",
  "nao_localizado",
  "divergente",
] as const;
export type NeoNivelEvidencia = (typeof NEO_NIVEL_EVIDENCIA)[number];

export const NEO_ALERTA_CATEGORIAS = [
  "informacao_ausente",
  "divergencia",
  "resultado_parcial",
  "limitacao",
  "cuidado_interpretativo",
] as const;
export type NeoAlertaCategoria = (typeof NEO_ALERTA_CATEGORIAS)[number];

// ---------------------------------------------------------------------------
// Fontes
// ---------------------------------------------------------------------------
export const neoFonteSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().nullable(),
  url: z.string().min(1),
  dominio: z.string().nullable(),
  dataAcesso: z.string().nullable(),
});
export type NeoFonte = z.infer<typeof neoFonteSchema>;

const rotuloValorSchema = z.object({ rotulo: z.string(), valor: z.string() });
const rotuloUrlSchema = z.object({ rotulo: z.string(), url: z.string() });

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------
export const neoBlocoTextoSchema = z.object({
  tipo: z.literal("texto"),
  titulo: z.string().nullable(),
  conteudo: z.string(),
  fontesIds: z.array(z.string()),
});

export const neoFatoSchema = z.object({
  rotulo: z.string(),
  valor: z.string(),
  tipo: z.string().nullable(),
  nivelEvidencia: z.enum(NEO_NIVEL_EVIDENCIA),
  dataObservacao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export type NeoFato = z.infer<typeof neoFatoSchema>;

export const neoBlocoFatosSchema = z.object({
  tipo: z.literal("fatos"),
  titulo: z.string().nullable(),
  itens: z.array(neoFatoSchema),
});

export const neoBlocoEntidadeSchema = z.object({
  tipo: z.literal("entidade"),
  nome: z.string(),
  subtitulo: z.string().nullable(),
  descricao: z.string().nullable(),
  imagemUrl: z.string().nullable(),
  identificadores: z.array(rotuloValorSchema),
  links: z.array(rotuloUrlSchema),
  metricas: z.array(rotuloValorSchema),
  atributos: z.array(rotuloValorSchema),
  fontesIds: z.array(z.string()),
});

export const neoMetricaSchema = z.object({
  rotulo: z.string(),
  valor: z.string(),
  unidade: z.string().nullable(),
  comparacao: z.string().nullable(),
  dataObservacao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export type NeoMetrica = z.infer<typeof neoMetricaSchema>;

export const neoBlocoMetricasSchema = z.object({
  tipo: z.literal("metricas"),
  titulo: z.string().nullable(),
  itens: z.array(neoMetricaSchema),
});

export const neoBlocoImagemSchema = z.object({
  tipo: z.literal("imagem"),
  url: z.string(),
  legenda: z.string().nullable(),
  textoAlternativo: z.string(),
  fontesIds: z.array(z.string()),
});

export const neoBlocoTabelaSchema = z.object({
  tipo: z.literal("tabela"),
  titulo: z.string().nullable(),
  colunas: z.array(z.string()),
  linhas: z.array(z.array(z.string())),
  fontesIds: z.array(z.string()),
  exportavelCsv: z.boolean(),
});

export const neoEventoTimelineSchema = z.object({
  data: z.string().nullable(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export const neoBlocoTimelineSchema = z.object({
  tipo: z.literal("timeline"),
  titulo: z.string().nullable(),
  itens: z.array(neoEventoTimelineSchema),
});

export const neoRelacaoSchema = z.object({
  origem: z.string(),
  relacao: z.string(),
  destino: z.string(),
  evidencia: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export const neoBlocoRelacoesSchema = z.object({
  tipo: z.literal("relacoes"),
  titulo: z.string().nullable(),
  itens: z.array(neoRelacaoSchema),
});

export const neoBlocoAlertaSchema = z.object({
  tipo: z.literal("alerta"),
  categoria: z.enum(NEO_ALERTA_CATEGORIAS),
  mensagem: z.string(),
});

export const neoBlocoFontesSchema = z.object({
  tipo: z.literal("fontes"),
  itens: z.array(neoFonteSchema),
});

export const neoBlocoSchema = z.discriminatedUnion("tipo", [
  neoBlocoTextoSchema,
  neoBlocoFatosSchema,
  neoBlocoEntidadeSchema,
  neoBlocoMetricasSchema,
  neoBlocoImagemSchema,
  neoBlocoTabelaSchema,
  neoBlocoTimelineSchema,
  neoBlocoRelacoesSchema,
  neoBlocoAlertaSchema,
  neoBlocoFontesSchema,
]);
export type NeoBloco = z.infer<typeof neoBlocoSchema>;
export type NeoBlocoTipo = NeoBloco["tipo"];

// ---------------------------------------------------------------------------
// NeoAnswer
// ---------------------------------------------------------------------------
export const neoAnswerSchema = z.object({
  version: z.literal(NEO_ANSWER_VERSION),
  status: z.enum(NEO_ANSWER_STATUS),
  titulo: z.string(),
  resumoExecutivo: z.string(),
  blocos: z.array(neoBlocoSchema),
  fontes: z.array(neoFonteSchema),
  informacoesAusentes: z.array(z.string()),
  observacoes: z.array(z.string()),
  proximasAcoes: z.array(z.string()),
  perguntaNecessaria: z.string().nullable(),
});
export type NeoAnswer = z.infer<typeof neoAnswerSchema>;

/** Safe, static fallback used when Structured Output validation fails twice in a row. */
export function buildFallbackAnswer(texto: string): NeoAnswer {
  return {
    version: NEO_ANSWER_VERSION,
    status: "parcial",
    titulo: "Resposta do Neo",
    resumoExecutivo: texto,
    blocos: [{ tipo: "texto", titulo: null, conteudo: texto, fontesIds: [] }],
    fontes: [],
    informacoesAusentes: [],
    observacoes: ["Não foi possível montar o relatório estruturado completo desta vez."],
    proximasAcoes: [],
    perguntaNecessaria: null,
  };
}
