import { z } from "zod";
import { neoAnswerSchema } from "@/lib/neo/answer";

/**
 * Discriminated event stream sent from the Neo execution endpoint (SSE) to
 * the browser. Every event is a friendly, already-translated status update
 * — never a raw tool name, payload, provider identifier, or chain of
 * thought. Shared client+server so both sides validate against the same
 * shape (server: src/server/neo/events.ts writer; client: use-neo-stream).
 */
export const neoEventoIniciadaSchema = z.object({
  tipo: z.literal("execucao.iniciada"),
  execucaoId: z.string(),
  mensagemId: z.string(),
});

export const neoEventoPlanoProntoSchema = z.object({
  tipo: z.literal("plano.pronto"),
  objetivo: z.string(),
  etapasPrevistas: z.array(z.string()),
});

export const neoEventoEtapaIniciadaSchema = z.object({
  tipo: z.literal("etapa.iniciada"),
  etapaId: z.string(),
  ordem: z.number(),
  nomePublico: z.string(),
});

export const neoEventoEtapaConcluidaSchema = z.object({
  tipo: z.literal("etapa.concluida"),
  etapaId: z.string(),
  ordem: z.number(),
  nomePublico: z.string(),
  resumo: z.string().nullable(),
});

export const neoEventoEtapaFalhouSchema = z.object({
  tipo: z.literal("etapa.falhou"),
  etapaId: z.string(),
  ordem: z.number(),
  nomePublico: z.string(),
  mensagem: z.string(),
});

export const neoEventoConfirmacaoNecessariaSchema = z.object({
  tipo: z.literal("confirmacao.necessaria"),
  execucaoId: z.string(),
  etapaId: z.string(),
  nomePublico: z.string(),
  descricao: z.string(),
});

export const neoEventoRespostaDeltaSchema = z.object({
  tipo: z.literal("resposta.delta"),
  texto: z.string(),
});

export const neoEventoRespostaConcluidaSchema = z.object({
  tipo: z.literal("resposta.concluida"),
  mensagemId: z.string(),
  resposta: neoAnswerSchema,
});

export const neoEventoParcialSchema = z.object({
  tipo: z.literal("execucao.parcial"),
  motivo: z.string(),
});

export const neoEventoCanceladaSchema = z.object({
  tipo: z.literal("execucao.cancelada"),
});

export const neoEventoFalhouSchema = z.object({
  tipo: z.literal("execucao.falhou"),
  mensagem: z.string(),
});

/**
 * Sent every NEO_LIMITS.heartbeatIntervalMs while an execution is running,
 * independent of tool activity — the client uses this (or any other event)
 * to know the stream is still alive and to detect a stalled connection that
 * never produced a terminal event (see the watchdog in use-neo-stream.ts).
 */
export const neoEventoHeartbeatSchema = z.object({
  tipo: z.literal("heartbeat"),
  execucaoId: z.string(),
  decorridoMs: z.number(),
});

export const neoEventSchema = z.discriminatedUnion("tipo", [
  neoEventoIniciadaSchema,
  neoEventoPlanoProntoSchema,
  neoEventoEtapaIniciadaSchema,
  neoEventoEtapaConcluidaSchema,
  neoEventoEtapaFalhouSchema,
  neoEventoConfirmacaoNecessariaSchema,
  neoEventoRespostaDeltaSchema,
  neoEventoRespostaConcluidaSchema,
  neoEventoParcialSchema,
  neoEventoCanceladaSchema,
  neoEventoFalhouSchema,
  neoEventoHeartbeatSchema,
]);

export type NeoEvent = z.infer<typeof neoEventSchema>;
export type NeoEventType = NeoEvent["tipo"];

export function parseNeoEvent(raw: unknown): NeoEvent | null {
  const parsed = neoEventSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
