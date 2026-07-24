import { describe, expect, it } from "vitest";
import { renderNeoAnswerAsMarkdown } from "./markdown";
import { NEO_ANSWER_VERSION, type NeoAnswer } from "@/lib/neo/answer";

function baseAnswer(overrides: Partial<NeoAnswer> = {}): NeoAnswer {
  return {
    version: NEO_ANSWER_VERSION,
    status: "completo",
    titulo: "Relatório de teste",
    resumoExecutivo: "Resumo executivo.",
    blocos: [],
    fontes: [],
    informacoesAusentes: [],
    observacoes: [],
    proximasAcoes: [],
    perguntaNecessaria: null,
    ...overrides,
  };
}

describe("renderNeoAnswerAsMarkdown", () => {
  it("includes the title and executive summary", () => {
    const md = renderNeoAnswerAsMarkdown(baseAnswer());
    expect(md).toContain("# Relatório de teste");
    expect(md).toContain("Resumo executivo.");
  });

  it("renders a table block as a Markdown table", () => {
    const md = renderNeoAnswerAsMarkdown(
      baseAnswer({
        blocos: [{ tipo: "tabela", titulo: "Dados", colunas: ["Nome", "Valor"], linhas: [["A", "1"]], fontesIds: [], exportavelCsv: true }],
      }),
    );
    expect(md).toContain("| Nome | Valor |");
    expect(md).toContain("| A | 1 |");
  });

  it("lists missing information and sources as separate sections", () => {
    const md = renderNeoAnswerAsMarkdown(
      baseAnswer({
        informacoesAusentes: ["Telefone"],
        fontes: [{ id: "f1", titulo: "Fonte A", url: "https://a.com", dominio: "a.com", dataAcesso: "2026-01-01" }],
      }),
    );
    expect(md).toContain("## Informações não localizadas");
    expect(md).toContain("Telefone");
    expect(md).toContain("## Fontes");
    expect(md).toContain("https://a.com");
  });

  it("never includes vendor/model/technical identifiers", () => {
    const md = renderNeoAnswerAsMarkdown(baseAnswer());
    for (const forbidden of ["OpenAI", "gpt-5", "Responses API", "SGAI", "scrapegraphai"]) {
      expect(md.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
