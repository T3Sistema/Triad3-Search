import { describe, expect, it } from "vitest";
import { buildEvidenceFallbackAnswer, hasFallbackEvidence, summarizeToolResult } from "@/server/neo/fallback-answer";

describe("summarizeToolResult", () => {
  it("counts a known array field when present", () => {
    expect(summarizeToolResult({ resultados: [1, 2, 3] })).toContain("3");
  });

  it("falls back to a generic message when no known field is found", () => {
    expect(summarizeToolResult({ algoDesconhecido: true })).toBe("Etapa concluída.");
  });

  it("never throws on null/undefined resumo", () => {
    expect(summarizeToolResult(null)).toBe("Etapa concluída.");
    expect(summarizeToolResult(undefined)).toBe("Etapa concluída.");
  });
});

describe("hasFallbackEvidence", () => {
  it("is true when at least one step succeeded", () => {
    expect(hasFallbackEvidence([{ nomePublico: "x", ok: true }], [])).toBe(true);
  });

  it("is true when at least one source was collected, even with zero successful steps", () => {
    expect(hasFallbackEvidence([], [{ url: "https://a.com" }])).toBe(true);
  });

  it("is false with nothing usable", () => {
    expect(hasFallbackEvidence([{ nomePublico: "x", ok: false, erroPublico: "falhou" }], [])).toBe(false);
  });
});

describe("buildEvidenceFallbackAnswer", () => {
  it("reproduces the incident: 9 completed searches, 0 sources persisted separately from the tool results", () => {
    const etapas = Array.from({ length: 9 }, (_, i) => ({
      nomePublico: "Pesquisando na web",
      ok: true,
      resumo: { resultados: [{ url: `https://site${i}.com` }] },
    }));
    const answer = buildEvidenceFallbackAnswer({
      motivo: "A execução foi interrompida antes da preparação do relatório.",
      etapas,
      fontes: [],
    });
    expect(answer.status).toBe("parcial");
    expect(answer.respostaDireta).toContain("9 etapa(s)");
    expect(answer.achados.length).toBe(9);
    expect(answer.matrizEvidencias.length).toBe(9);
  });

  it("never fabricates a source id — only ever cites URLs actually passed in", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [],
      fontes: [{ url: "https://real.example" }],
    });
    expect(answer.fontes).toEqual([expect.objectContaining({ url: "https://real.example", id: "f1" })]);
  });

  it("lists failed steps under lacunas instead of silently dropping them", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [{ nomePublico: "Capturando página", ok: false, erroPublico: "Tempo esgotado." }],
      fontes: [],
    });
    expect(answer.lacunas[0].descricao).toContain("Capturando página");
    expect(answer.lacunas[0].descricao).toContain("Tempo esgotado.");
    expect(answer.lacunas[0].tipo).toBe("nao_encontrado");
  });

  it("never renders as completo — always parcial, since it's a fallback by definition", () => {
    const answer = buildEvidenceFallbackAnswer({ motivo: "x", etapas: [{ nomePublico: "a", ok: true }], fontes: [] });
    expect(answer.status).toBe("parcial");
  });

  it("suggests continuing only when there is something to continue from", () => {
    const semEvidencia = buildEvidenceFallbackAnswer({ motivo: "x", etapas: [], fontes: [] });
    expect(semEvidencia.proximasAcoes).toEqual([]);
    const comEvidencia = buildEvidenceFallbackAnswer({ motivo: "x", etapas: [{ nomePublico: "a", ok: true }], fontes: [] });
    expect(comEvidencia.proximasAcoes.length).toBeGreaterThan(0);
  });
});
