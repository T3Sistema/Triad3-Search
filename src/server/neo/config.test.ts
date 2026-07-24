import { describe, expect, it, afterEach } from "vitest";
import { getNeoApiKey, isNeoConfigured } from "./config";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

describe("neo config", () => {
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  it("reports not configured when OPENAI_API_KEY is missing", () => {
    delete process.env.OPENAI_API_KEY;
    expect(getNeoApiKey()).toBeUndefined();
    expect(isNeoConfigured()).toBe(false);
  });

  it("reports not configured for a blank/whitespace-only key", () => {
    process.env.OPENAI_API_KEY = "   ";
    expect(getNeoApiKey()).toBeUndefined();
    expect(isNeoConfigured()).toBe(false);
  });

  it("returns the trimmed key when present", () => {
    process.env.OPENAI_API_KEY = "  sk-test-key  ";
    expect(getNeoApiKey()).toBe("sk-test-key");
    expect(isNeoConfigured()).toBe(true);
  });
});
