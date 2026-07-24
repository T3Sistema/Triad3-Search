import { describe, expect, it } from "vitest";
import { isStrongPassword, isValidEmail, normalizeEmail } from "./validation";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Fulano@Triad3.Com  ")).toBe("fulano@triad3.com");
  });
});

describe("isValidEmail", () => {
  it("accepts a plausible e-mail", () => {
    expect(isValidEmail("fulano@triad3.com")).toBe(true);
  });

  it("rejects strings without an @ or domain", () => {
    expect(isValidEmail("fulano")).toBe(false);
    expect(isValidEmail("fulano@")).toBe(false);
    expect(isValidEmail("@triad3.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isStrongPassword", () => {
  it("requires at least 12 characters", () => {
    expect(isStrongPassword("a".repeat(11))).toBe(false);
    expect(isStrongPassword("a".repeat(12))).toBe(true);
  });
});
