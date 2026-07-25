import "server-only";
import { z } from "zod";
import { neoAnswerSchema } from "@/lib/neo/answer";
import { neoClarificationFormSchema } from "@/lib/neo/clarification-form";

/**
 * NeoAgentTurn — the single Structured Output schema every round of the
 * agent loop (src/server/neo/agent.ts) can produce whenever it decides NOT
 * to call a tool. The model chooses exactly one of these per turn: a plain
 * conversational reply, a clarifying question, an inline form for
 * indispensable structured input, or the final consolidated report. There is
 * no separate planning/evaluation/synthesis schema anymore — this replaces
 * all three; the same call that reads tool results decides the next step.
 */
export const neoRespostaTurnoSchema = z.object({
  tipo: z.literal("resposta"),
  texto: z.string(),
});

export const neoPerguntaTurnoSchema = z.object({
  tipo: z.literal("pergunta"),
  texto: z.string(),
});

export const neoFormularioTurnoSchema = z.object({
  tipo: z.literal("formulario"),
  formulario: neoClarificationFormSchema,
});

export const neoRelatorioTurnoSchema = z.object({
  tipo: z.literal("relatorio"),
  relatorio: neoAnswerSchema,
});

export const neoAgentTurnSchema = z.discriminatedUnion("tipo", [
  neoRespostaTurnoSchema,
  neoPerguntaTurnoSchema,
  neoFormularioTurnoSchema,
  neoRelatorioTurnoSchema,
]);
export type NeoAgentTurn = z.infer<typeof neoAgentTurnSchema>;

/**
 * OpenAI's Structured Outputs mode requires the root schema to have
 * `type: "object"` — a discriminated union can't be the root schema itself
 * (see node_modules/openai/helpers/zod.js `toStrictJsonSchema`). This is the
 * schema actually passed as `text.format` in every agent.ts call; the
 * discriminated union lives one level down, as its only field.
 */
export const neoAgentTurnResponseSchema = z.object({ decisao: neoAgentTurnSchema });

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
