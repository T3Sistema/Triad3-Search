import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { callNeoResponses } from "@/server/neo/client";
import { NEO_MODEL } from "@/server/neo/model";
import { NEO_SYSTEM_PROMPT } from "@/server/neo/prompt";
import { neoPlanSchema, type NeoPlan } from "@/server/neo/schemas";
import { NEO_TOOL_NAMES } from "@/server/neo/tool-names";
import { normalizeThrownError, type NeoError } from "@/server/neo/errors";

export interface PlannerMessage {
  papel: "usuario" | "assistente";
  conteudo: string;
}

export interface PlannerInput {
  mensagemAtual: string;
  resumoContexto: string | null;
  mensagensRecentes: PlannerMessage[];
}

export type PlanResult = { ok: true; plan: NeoPlan } | { ok: false; error: NeoError };

function buildPlannerPrompt(input: PlannerInput): string {
  const parts: string[] = [];
  if (input.resumoContexto) {
    parts.push(`Resumo acumulado da conversa até agora:\n${input.resumoContexto}`);
  }
  if (input.mensagensRecentes.length > 0) {
    const transcript = input.mensagensRecentes
      .map((m) => `${m.papel === "usuario" ? "Usuário" : "Neo"}: ${m.conteudo}`)
      .join("\n");
    parts.push(`Mensagens recentes:\n${transcript}`);
  }
  parts.push(
    `Ferramentas internas disponíveis (nomes estáveis, escolha livremente a combinação necessária): ${NEO_TOOL_NAMES.join(", ")}.`,
  );
  parts.push(`Nova mensagem do usuário a compreender e planejar:\n${input.mensagemAtual}`);
  parts.push(
    "Produza o plano estruturado: objetivo interpretado, se há ambiguidade realmente bloqueante, etapas planejadas em linguagem operacional (ex.: 'Localizar fontes sobre o alvo'), dados que precisam ser localizados, critérios de conclusão, ferramentas provavelmente necessárias, se etapas independentes podem rodar em paralelo, riscos de confundir entidades, campos solicitados pelo usuário e o formato esperado do relatório final.",
  );
  return parts.join("\n\n");
}

export async function planInvestigation(input: PlannerInput, signal?: AbortSignal): Promise<PlanResult> {
  try {
    const response = await callNeoResponses(
      {
        model: NEO_MODEL,
        instructions: NEO_SYSTEM_PROMPT,
        input: buildPlannerPrompt(input),
        text: { format: zodTextFormat(neoPlanSchema, "neo_plan") },
        reasoning: { effort: "high" },
        store: false,
      },
      signal,
    );

    const raw = response.output_text;
    if (!raw) return { ok: false, error: { type: "provider_error", message: "Não foi possível iniciar a análise.", httpStatus: 502 } };

    const parsed = neoPlanSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { ok: false, error: { type: "provider_error", message: "Não foi possível iniciar a análise.", httpStatus: 502 } };
    }
    return { ok: true, plan: parsed.data };
  } catch (err) {
    return { ok: false, error: normalizeThrownError(err) };
  }
}
