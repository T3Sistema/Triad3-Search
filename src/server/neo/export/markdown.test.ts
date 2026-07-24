import { describe, expect, it } from "vitest";
import { renderNeoAnswerAsMarkdown } from "./markdown";
import { baseNeoAnswer as baseAnswer } from "@/lib/neo/answer-fixtures";

describe("renderNeoAnswerAsMarkdown", () => {
  it("includes the title and direct answer", () => {
    const md = renderNeoAnswerAsMarkdown(baseAnswer({ respostaDireta: "Resumo executivo." }));
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

  it("lists gaps and sources as separate sections", () => {
    const md = renderNeoAnswerAsMarkdown(
      baseAnswer({
        lacunas: [{ tipo: "nao_encontrado", descricao: "Telefone" }],
        fontes: [{ id: "f1", titulo: "Fonte A", url: "https://a.com", dominio: "a.com", dataAcesso: "2026-01-01" }],
      }),
    );
    expect(md).toContain("## O que ainda precisa ser confirmado");
    expect(md).toContain("Telefone");
    expect(md).toContain("## Fontes utilizadas");
    expect(md).toContain("https://a.com");
  });

  it("never includes vendor/model/technical identifiers", () => {
    const md = renderNeoAnswerAsMarkdown(baseAnswer());
    for (const forbidden of ["OpenAI", "gpt-5", "Responses API", "SGAI", "scrapegraphai"]) {
      expect(md.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
