import { describe, expect, it } from "vitest";
import { exportNeoAnswerTableAsCsv } from "./csv";
import type { NeoAnswer } from "@/lib/neo/answer";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

function answerWithTables(): NeoAnswer {
  return baseNeoAnswer({
    blocos: [
      { tipo: "tabela", titulo: "Primeira", colunas: ["Nome", "Cidade"], linhas: [["Ana, Silva", 'Rio "RJ"']], fontesIds: [], exportavelCsv: true },
      { tipo: "tabela", titulo: "Segunda", colunas: ["X"], linhas: [["1"]], fontesIds: [], exportavelCsv: true },
    ],
  });
}

describe("exportNeoAnswerTableAsCsv", () => {
  it("exports the requested table by index with a UTF-8 BOM", () => {
    const result = exportNeoAnswerTableAsCsv(answerWithTables(), 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.csv.charCodeAt(0)).toBe(0xfeff);
      expect(result.csv).toContain("Nome,Cidade");
    }
  });

  it("escapes commas and quotes correctly", () => {
    const result = exportNeoAnswerTableAsCsv(answerWithTables(), 0);
    if (result.ok) {
      expect(result.csv).toContain('"Ana, Silva"');
      expect(result.csv).toContain('"Rio ""RJ"""');
    }
  });

  it("exports the second table independently from the first", () => {
    const result = exportNeoAnswerTableAsCsv(answerWithTables(), 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.csv).toContain("X");
  });

  it("returns a handled error for an out-of-range table index instead of throwing", () => {
    const result = exportNeoAnswerTableAsCsv(answerWithTables(), 5);
    expect(result.ok).toBe(false);
  });

  it("returns a handled error when the report has no tables at all", () => {
    const answer = { ...answerWithTables(), blocos: [] };
    const result = exportNeoAnswerTableAsCsv(answer, 0);
    expect(result.ok).toBe(false);
  });
});
