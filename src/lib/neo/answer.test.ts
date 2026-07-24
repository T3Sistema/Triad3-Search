import { describe, expect, it } from "vitest";
import { neoAnswerSchema, buildFallbackAnswer, NEO_ANSWER_VERSION } from "./answer";

function validAnswer() {
  return {
    version: NEO_ANSWER_VERSION,
    status: "completo" as const,
    titulo: "Relatório de teste",
    resumoExecutivo: "Resumo.",
    blocos: [
      { tipo: "texto" as const, titulo: null, conteudo: "Conteúdo", fontesIds: [] },
      {
        tipo: "fatos" as const,
        titulo: null,
        itens: [{ rotulo: "Nome", valor: "Ana", tipo: null, nivelEvidencia: "confirmado" as const, dataObservacao: null, fontesIds: ["f1"] }],
      },
    ],
    fontes: [{ id: "f1", titulo: "Fonte", url: "https://example.com", dominio: "example.com", dataAcesso: "2026-01-01" }],
    informacoesAusentes: [],
    observacoes: [],
    proximasAcoes: [],
    perguntaNecessaria: null,
  };
}

describe("neoAnswerSchema", () => {
  it("accepts a well-formed answer", () => {
    expect(neoAnswerSchema.safeParse(validAnswer()).success).toBe(true);
  });

  it("rejects an invalid nivelEvidencia value (never let an unknown confidence label through)", () => {
    const answer = validAnswer();
    // @ts-expect-error intentionally invalid for the test
    answer.blocos[1].itens[0].nivelEvidencia = "muito_confiavel";
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("rejects an unknown block type", () => {
    const answer = validAnswer();
    // @ts-expect-error intentionally invalid for the test
    answer.blocos.push({ tipo: "video", url: "https://example.com/v.mp4" });
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("rejects a wrong schema version", () => {
    const answer = { ...validAnswer(), version: 2 as unknown as typeof NEO_ANSWER_VERSION };
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("requires status to be one of the three known values", () => {
    const answer = { ...validAnswer(), status: "em_andamento" as unknown as "completo" };
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });
});

describe("buildFallbackAnswer", () => {
  it("always produces a schema-valid answer, even as a last-resort fallback", () => {
    const fallback = buildFallbackAnswer("Não foi possível montar o relatório.");
    expect(neoAnswerSchema.safeParse(fallback).success).toBe(true);
    expect(fallback.status).toBe("parcial");
  });
});
