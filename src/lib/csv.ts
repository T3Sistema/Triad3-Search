/**
 * Client-side CSV conversion. Flattens simple (string/number/boolean/null)
 * top-level fields into columns; arrays and objects are preserved as a JSON
 * string in a single cell so no data is lost.
 */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const lines = [columns.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(stringifyCell(row[col]))).join(","));
  }
  return lines.join("\r\n");
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** UTF-8 BOM so Excel opens accented characters correctly. */
export function withCsvBom(csv: string): string {
  return "﻿" + csv;
}
