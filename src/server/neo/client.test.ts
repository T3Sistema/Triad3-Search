import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { getNeoClient, __resetNeoClientForTests } from "./client";
import { NeoConfigurationError } from "./errors";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

describe("getNeoClient", () => {
  beforeEach(() => __resetNeoClientForTests());
  afterEach(() => {
    __resetNeoClientForTests();
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  it("throws a handled NeoConfigurationError instead of crashing when no key is set", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => getNeoClient()).toThrow(NeoConfigurationError);
  });

  it("never falls back to any default/alternate key", () => {
    delete process.env.OPENAI_API_KEY;
    try {
      getNeoClient();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NeoConfigurationError);
    }
  });

  it("returns the same cached client instance across calls once configured", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    const first = getNeoClient();
    const second = getNeoClient();
    expect(first).toBe(second);
  });
});
