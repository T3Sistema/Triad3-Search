import "server-only";
import { withCsvBom } from "@/lib/csv";
import type { NeoAnswer } from "@/lib/neo/answer";

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export interface NeoTableExportResult {
  ok: true;
  csv: string;
  titulo: string;
}
export interface NeoTableExportError {
  ok: false;
  erroPublico: string;
}

/** Exports a single "tabela" block from a NeoAnswer as UTF-8 CSV with a BOM (Excel-friendly). */
export function exportNeoAnswerTableAsCsv(answer: NeoAnswer, indice: number): NeoTableExportResult | NeoTableExportError {
  const tabelas = answer.blocos.filter((b) => b.tipo === "tabela");
  const tabela = tabelas[indice];
  if (!tabela) return { ok: false, erroPublico: "Tabela não encontrada neste relatório." };

  const lines = [tabela.colunas.map(csvEscape).join(",")];
  for (const linha of tabela.linhas) {
    lines.push(linha.map((cell) => csvEscape(cell)).join(","));
  }
  return { ok: true, csv: withCsvBom(lines.join("\r\n")), titulo: tabela.titulo ?? `tabela-${indice + 1}` };
}
