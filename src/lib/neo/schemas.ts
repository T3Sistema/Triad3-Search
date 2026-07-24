import { z } from "zod";
import { NEO_MESSAGE_MAX_LENGTH } from "@/lib/neo/limits";

export const criarConversaRequestSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
});
export type CriarConversaRequest = z.infer<typeof criarConversaRequestSchema>;

export const atualizarConversaRequestSchema = z.object({
  titulo: z.string().min(1, "Informe um título.").max(200).optional(),
  status: z.enum(["ativa", "arquivada"]).optional(),
});
export type AtualizarConversaRequest = z.infer<typeof atualizarConversaRequestSchema>;

export const executarConversaRequestSchema = z.object({
  mensagem: z
    .string()
    .min(1, "Escreva uma mensagem.")
    .max(NEO_MESSAGE_MAX_LENGTH, `A mensagem excede o limite de ${NEO_MESSAGE_MAX_LENGTH} caracteres.`),
  idempotencyKey: z.string().min(1).max(200).optional(),
});
export type ExecutarConversaRequest = z.infer<typeof executarConversaRequestSchema>;

export const confirmarExecucaoRequestSchema = z.object({
  confirmar: z.boolean(),
});
export type ConfirmarExecucaoRequest = z.infer<typeof confirmarExecucaoRequestSchema>;

export const listarConversasQuerySchema = z.object({
  busca: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
