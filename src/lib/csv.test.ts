import { describe, expect, it } from "vitest";
import { rowsToCsv, withCsvBom } from "./csv";

describe("rowsToCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(rowsToCsv([])).toBe("");
  });

  it("flattens simple scalar fields into columns", () => {
    const csv = rowsToCsv([{ url: "https://example.com", depth: 1 }]);
    expect(csv).toContain("url,depth");
    expect(csv).toContain("https://example.com,1");
  });

  it("preserves arrays and objects as JSON in a single cell", () => {
    const csv = rowsToCsv([{ tags: ["a", "b"] }]);
    expect(csv).toContain('"[""a"",""b""]"');
  });

  it("escapes commas, quotes and newlines", () => {
    const csv = rowsToCsv([{ note: 'has "quotes", a comma\nand a newline' }]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('"has ""quotes"", a comma\nand a newline"');
  });
});

describe("withCsvBom", () => {
  it("prefixes the CSV with a UTF-8 BOM", () => {
    const withBom = withCsvBom("a,b");
    expect(withBom.charCodeAt(0)).toBe(0xfeff);
  });
});
