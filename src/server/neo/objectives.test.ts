import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/neo/client", () => ({ callNeoResponses: vi.fn() }));

import { callNeoResponses } from "@/server/neo/client";
import { avaliarObjetivos, buildInitialObjectives } from "@/server/neo/objectives";

type FakeResponse = Awaited<ReturnType<typeof callNeoResponses>>;

function textResponse(body: unknown): FakeResponse {
  return { usage: { input_tokens: 5, output_tokens: 5 }, output_text: JSON.stringify(body) } as unknown as FakeResponse;
}

const basePlan = {
  objetivoInterpretado: "Investigar um alvo genérico.",
  ambiguidadeBloqueante: false,
  perguntaNecessaria: null,
  etapasPlanejadas: [],
  dadosNecessarios: [] as string[],
  criteriosConclusao: [],
  ferramentasProvaveis: [],
  execucaoParalelaPossivel: true,
  riscoConfusaoEntidades: null,
  camposSolicitados: [] as string[],
  formatoRelatorioEsperado: "texto",
};

beforeEach(() => vi.mocked(callNeoResponses).mockReset());

describe("buildInitialObjectives", () => {
  it("seeds one pendente objective per requested field", () => {
    const objetivos = buildInitialObjectives({ ...basePlan, camposSolicitados: ["CNPJ", "Instagram oficial"] });
    expect(objetivos).toEqual([
      { descricao: "CNPJ", status: "pendente" },
      { descricao: "Instagram oficial", status: "pendente" },
    ]);
  });

  it("falls back to dadosNecessarios when the user didn't name specific fields", () => {
    const objetivos = buildInitialObjectives({ ...basePlan, camposSolicitados: [], dadosNecessarios: ["histórico do domínio"] });
    expect(objetivos).toEqual([{ descricao: "histórico do domínio", status: "pendente" }]);
  });

  it("dedupes case-insensitively and trims whitespace, never creating an empty objective", () => {
    const objetivos = buildInitialObjectives({ ...basePlan, camposSolicitados: [" CNPJ ", "cnpj", "", "  "] });
    expect(objetivos).toEqual([{ descricao: "CNPJ", status: "pendente" }]);
  });

  it("returns no objectives when the plan named nothing specific — the executor must skip evaluation entirely in that case", () => {
    expect(buildInitialObjectives(basePlan)).toEqual([]);
  });
});

describe("avaliarObjetivos", () => {
  const input = {
    objetivoInterpretado: "Investigar um alvo genérico.",
    objetivos: [{ descricao: "CNPJ", status: "pendente" as const }],
    evidence: [{ ferramenta: "pesquisar_web", ok: true, resumo: { resultados: [] } }],
  };

  it("parses a well-formed evaluation response", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(
      textResponse({ objetivos: [{ descricao: "CNPJ", status: "encontrado" }], podeEncerrar: true, motivo: "Resolvido." }),
    );
    const result = await avaliarObjetivos(input);
    expect(result).toEqual({ objetivos: [{ descricao: "CNPJ", status: "encontrado" }], podeEncerrar: true, motivo: "Resolvido." });
  });

  it("fails open (returns null) on malformed JSON instead of throwing", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce({ usage: {}, output_text: "not json" } as unknown as FakeResponse);
    await expect(avaliarObjetivos(input)).resolves.toBeNull();
  });

  it("fails open (returns null) when the response fails schema validation", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce(textResponse({ objetivos: "não é uma lista", podeEncerrar: "sim" }));
    await expect(avaliarObjetivos(input)).resolves.toBeNull();
  });

  it("fails open (returns null) when the underlying call rejects — never throws, never blocks the investigation", async () => {
    vi.mocked(callNeoResponses).mockRejectedValueOnce(new Error("network down"));
    await expect(avaliarObjetivos(input)).resolves.toBeNull();
  });

  it("fails open (returns null) when there is no output_text at all", async () => {
    vi.mocked(callNeoResponses).mockResolvedValueOnce({ usage: {}, output_text: undefined } as unknown as FakeResponse);
    await expect(avaliarObjetivos(input)).resolves.toBeNull();
  });
});
