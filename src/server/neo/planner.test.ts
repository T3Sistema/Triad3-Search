import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { planInvestigation } from "@/server/neo/planner";

type FakeResponse = Awaited<ReturnType<typeof callNeoResponses>>;

/** Only `usage`/`output_text` matter to planner.ts — the rest of the real Response shape doesn't. */
function fakeTextResponse(outputText: string, usage = { input_tokens: 5, output_tokens: 5 }): FakeResponse {
  return { usage, output_text: outputText } as unknown as FakeResponse;
}

function validPlanJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    objetivoInterpretado: "Investigar um alvo genérico.",
    ambiguidadeBloqueante: false,
    perguntaNecessaria: null,
    etapasPlanejadas: ["Localizar fontes"],
    dadosNecessarios: [],
    criteriosConclusao: ["Ao menos uma fonte"],
    ferramentasProvaveis: ["pesquisar_web"],
    execucaoParalelaPossivel: true,
    riscoConfusaoEntidades: null,
    camposSolicitados: [],
    formatoRelatorioEsperado: "texto",
    ...overrides,
  });
}

const baseInput = { mensagemAtual: "investigue algo", resumoContexto: null, mensagensRecentes: [] };

describe("planInvestigation", () => {
  beforeEach(async () => {
    vi.mocked(callNeoResponses).mockReset();
  });

  it("returns a valid plan parsed from the model's structured output", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(validPlanJson()));
    const result = await planInvestigation(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.objetivoInterpretado).toBe("Investigar um alvo genérico.");
  });

  it("carries the conversation summary and recent messages into the prompt sent to the model", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(validPlanJson()));
    await planInvestigation({
      mensagemAtual: "continue",
      resumoContexto: "Resumo anterior sobre a Empresa X.",
      mensagensRecentes: [{ papel: "usuario", conteudo: "primeira pergunta" }],
    });
    const call = vi.mocked(callNeoResponses).mock.calls[0]![0];
    expect(call.input as string).toContain("Empresa X");
    expect(call.input as string).toContain("primeira pergunta");
  });

  it("uses reasoning effort 'high' and disables no tools during planning (text-only structured output)", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(validPlanJson()));
    await planInvestigation(baseInput);
    const call = vi.mocked(callNeoResponses).mock.calls[0]![0];
    expect(call.reasoning).toEqual({ effort: "high" });
    expect(call.store).toBe(false);
  });

  it("returns a handled error when the model returns text that fails schema validation", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(fakeTextResponse(JSON.stringify({ incompleto: true })));
    const result = await planInvestigation(baseInput);
    expect(result.ok).toBe(false);
  });

  it("accepts a blocking-ambiguity plan carrying a follow-up question", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(
      fakeTextResponse(validPlanJson({ ambiguidadeBloqueante: true, perguntaNecessaria: "Qual empresa, exatamente?" })),
    );
    const result = await planInvestigation(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.ambiguidadeBloqueante).toBe(true);
      expect(result.plan.perguntaNecessaria).toBe("Qual empresa, exatamente?");
    }
  });
});
