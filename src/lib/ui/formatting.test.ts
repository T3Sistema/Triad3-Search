import { describe, expect, it } from "vitest";
import { formatDateTime, formatMilliseconds, formatNumber } from "./formatting";

describe("formatDateTime", () => {
  it("formats a date using pt-BR conventions (day/month/year)", () => {
    const result = formatDateTime("2026-01-15T10:00:00Z");
    // pt-BR uses DD/MM/YYYY — never the en-US MM/DD/YYYY order.
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
  });

  it("returns a placeholder for missing/invalid input", () => {
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
  });
});

describe("formatNumber", () => {
  it("uses the pt-BR thousands separator", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
  });

  it("returns a placeholder for missing input", () => {
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(null)).toBe("—");
  });
});

describe("formatMilliseconds", () => {
  it("appends the ms unit using pt-BR number formatting", () => {
    expect(formatMilliseconds(2500)).toBe("2.500 ms");
  });
});
