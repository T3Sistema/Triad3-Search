// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExportMenu } from "./export-menu";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

describe("ExportMenu", () => {
  it("always offers the PDF and Markdown downloads, using the exact required PDF label", () => {
    render(<ExportMenu mensagemId="m1" answer={baseNeoAnswer()} />);
    expect(screen.getByRole("button", { name: /Baixar relatório em PDF/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Baixar Markdown/ })).toBeInTheDocument();
  });

  it("never offers a CSV download when the report has no table blocks", () => {
    render(<ExportMenu mensagemId="m1" answer={baseNeoAnswer({ blocos: [] })} />);
    expect(screen.queryByRole("button", { name: /CSV/ })).not.toBeInTheDocument();
  });

  it("offers one CSV download per table block, only when tables actually exist", () => {
    render(
      <ExportMenu
        mensagemId="m1"
        answer={baseNeoAnswer({
          blocos: [
            { tipo: "tabela", titulo: "A", colunas: ["x"], linhas: [["1"]], fontesIds: [], exportavelCsv: true },
            { tipo: "tabela", titulo: "B", colunas: ["y"], linhas: [["2"]], fontesIds: [], exportavelCsv: true },
          ],
        })}
      />,
    );
    expect(screen.getAllByRole("button", { name: /CSV/ })).toHaveLength(2);
  });
});
