import { describe, expect, it } from "vitest";
import { z } from "zod";
import { callNeoResponses } from "./client";
import { NEO_MODEL } from "./model";
import { neoAgentTurnSchema } from "./schemas";
import { zodTextFormat, zodResponsesFunction } from "openai/helpers/zod";

/**
 * Opt-in tests that hit the real OpenAI Responses API using NEO_MODEL. Skipped
 * unless both RUN_NEO_LIVE_TESTS=true and OPENAI_API_KEY are set —
 * `npm run test` never spends real LLM credits by default.
 *
 * Uses only fake, harmless tools (never the real monitor_criar/excluir), no
 * personal data, and small prompts to keep token usage minimal. Never logs
 * or asserts on the API key.
 */
const isLive = process.env.RUN_NEO_LIVE_TESTS === "true" && Boolean(process.env.OPENAI_API_KEY);

describe.skipIf(!isLive)("live Neo LLM integration", () => {
  it("produces a schema-valid NeoAgentTurn decision for a trivial, generic request", async () => {
    const response = await callNeoResponses({
      model: NEO_MODEL,
      instructions: "Você é um agente que responde pedidos em texto livre. Responda em português do Brasil.",
      input: "Quero saber o horário de funcionamento de uma biblioteca pública genérica.",
      text: { format: zodTextFormat(neoAgentTurnSchema, "neo_agent_turn_live_check") },
      reasoning: { effort: "high" },
      store: false,
    });
    expect(response.output_text).toBeTruthy();
    const parsed = neoAgentTurnSchema.safeParse(JSON.parse(response.output_text!));
    expect(parsed.success).toBe(true);
  });

  it("selects a fake, harmless tool by function-calling when the request clearly needs it", async () => {
    const fakeTool = zodResponsesFunction({
      name: "consultar_clima_fake",
      description: "Consulta o clima atual de uma cidade. Use sempre que o usuário perguntar sobre o clima.",
      parameters: z.object({ cidade: z.string() }),
    });

    const response = await callNeoResponses({
      model: NEO_MODEL,
      instructions: "Você escolhe ferramentas quando necessário. Responda em português do Brasil.",
      input: "Qual é o clima agora em uma cidade genérica de exemplo?",
      tools: [fakeTool],
      reasoning: { effort: "high" },
      store: false,
    });

    const functionCalls = (response.output ?? []).filter((item) => item.type === "function_call");
    expect(functionCalls.length).toBeGreaterThan(0);
    expect(functionCalls[0]?.name).toBe("consultar_clima_fake");
  });
});
