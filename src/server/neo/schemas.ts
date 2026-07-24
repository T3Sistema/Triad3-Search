import "server-only";
import { z } from "zod";
import { NEO_TOOL_NAMES } from "@/server/neo/tool-names";

/**
 * NeoPlan — Structured Output schema for Phase 1 (understanding +
 * planning). Entirely internal: the frontend never receives this object
 * directly, only a translated, friendly summary of `etapasPlanejadas`
 * turned into "etapa.iniciada"/"etapa.concluida" events (see orchestrator.ts).
 * All fields required; optional ones are `.nullable()` for OpenAI's strict
 * Structured Outputs mode.
 */
export const neoPlanSchema = z.object({
  objetivoInterpretado: z.string(),
  ambiguidadeBloqueante: z.boolean(),
  perguntaNecessaria: z.string().nullable(),
  etapasPlanejadas: z.array(z.string()),
  dadosNecessarios: z.array(z.string()),
  criteriosConclusao: z.array(z.string()),
  ferramentasProvaveis: z.array(z.enum(NEO_TOOL_NAMES)),
  execucaoParalelaPossivel: z.boolean(),
  riscoConfusaoEntidades: z.string().nullable(),
  camposSolicitados: z.array(z.string()),
  formatoRelatorioEsperado: z.string(),
});
export type NeoPlan = z.infer<typeof neoPlanSchema>;

/** Rolling conversation summary, refreshed by the same NEO_MODEL when history grows too long. */
export const neoResumoConversaSchema = z.object({
  resumo: z.string(),
});
export type NeoResumoConversa = z.infer<typeof neoResumoConversaSchema>;

/** Auto-generated conversation title from the first message. */
export const neoTituloConversaSchema = z.object({
  titulo: z.string(),
});
export type NeoTituloConversa = z.infer<typeof neoTituloConversaSchema>;
