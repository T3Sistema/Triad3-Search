import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { callNeoResponses } from "@/server/neo/client";
import { NEO_MODEL } from "@/server/neo/model";
import { neoResumoConversaSchema, neoTituloConversaSchema } from "@/server/neo/schemas";

/**
 * Conversation memory: since Neo never relies on provider-side history
 * (`store: false`, no `previous_response_id`), long conversations are kept
 * usable through a rolling summary + a bounded window of recent messages
 * loaded from the database (see src/server/neo/orchestrator.ts). Both the
 * title and the summary use NEO_MODEL, same as every other Neo call.
 */

function fallbackTitle(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Nova conversa";
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

export async function generateConversationTitle(firstMessage: string, signal?: AbortSignal): Promise<string> {
  try {
    const response = await callNeoResponses(
      {
        model: NEO_MODEL,
        instructions:
          "Gere um título curto (até 60 caracteres), neutro e descritivo em português do Brasil para esta conversa, a partir da primeira mensagem do usuário. Não use aspas nem pontuação final.",
        input: firstMessage,
        text: { format: zodTextFormat(neoTituloConversaSchema, "neo_titulo") },
        reasoning: { effort: "medium" },
        store: false,
      },
      signal,
    );
    const raw = response.output_text;
    if (!raw) return fallbackTitle(firstMessage);
    const parsed = neoTituloConversaSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.titulo.trim() ? parsed.data.titulo.trim().slice(0, 80) : fallbackTitle(firstMessage);
  } catch {
    return fallbackTitle(firstMessage);
  }
}

export interface RefreshSummaryInput {
  resumoAnterior: string | null;
  mensagens: Array<{ papel: string; conteudo: string }>;
}

export async function refreshConversationSummary(input: RefreshSummaryInput, signal?: AbortSignal): Promise<string | null> {
  try {
    const transcript = input.mensagens.map((m) => `${m.papel}: ${m.conteudo}`).join("\n");
    const prompt = input.resumoAnterior
      ? `Resumo anterior:\n${input.resumoAnterior}\n\nNovas mensagens:\n${transcript}`
      : `Mensagens:\n${transcript}`;
    const response = await callNeoResponses(
      {
        model: NEO_MODEL,
        instructions:
          "Atualize um resumo objetivo (até 1500 caracteres) da investigação em andamento nesta conversa, em português do Brasil, preservando alvos identificados, fatos já confirmados, lacunas conhecidas e decisões relevantes. Não inclua dado bruto extenso nem trecho de página inteiro.",
        input: prompt,
        text: { format: zodTextFormat(neoResumoConversaSchema, "neo_resumo") },
        reasoning: { effort: "medium" },
        store: false,
      },
      signal,
    );
    const raw = response.output_text;
    if (!raw) return input.resumoAnterior;
    const parsed = neoResumoConversaSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.resumo : input.resumoAnterior;
  } catch {
    return input.resumoAnterior;
  }
}
