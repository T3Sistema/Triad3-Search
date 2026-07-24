import { describe, expect, it } from "vitest";
import { neoError, normalizeThrownError, sanitizeNeoError, NeoConfigurationError } from "./errors";

describe("sanitizeNeoError", () => {
  it("returns undefined for empty/whitespace input", () => {
    expect(sanitizeNeoError(undefined)).toBeUndefined();
    expect(sanitizeNeoError(null)).toBeUndefined();
    expect(sanitizeNeoError("   ")).toBeUndefined();
  });

  it("strips messages that mention the LLM provider name", () => {
    expect(sanitizeNeoError("OpenAI returned an error")).toBeUndefined();
    expect(sanitizeNeoError("Request to openai.com failed")).toBeUndefined();
  });

  it("strips messages that mention the model name or API surface", () => {
    expect(sanitizeNeoError("gpt-5.4-mini is overloaded")).toBeUndefined();
    expect(sanitizeNeoError("Responses API returned 500")).toBeUndefined();
  });

  it("strips messages containing an API key or auth header", () => {
    expect(sanitizeNeoError("Invalid api_key provided")).toBeUndefined();
    expect(sanitizeNeoError("sk-abc123 is not a valid key")).toBeUndefined();
  });

  it("removes bare domains from an otherwise-safe message", () => {
    const result = sanitizeNeoError("Failed to reach api.example.com during processing");
    expect(result).not.toContain("api.example.com");
  });

  it("keeps a genuinely clean, short message intact", () => {
    expect(sanitizeNeoError("Tempo de resposta excedido")).toBe("Tempo de resposta excedido");
  });

  it("truncates overly long messages", () => {
    const long = "a".repeat(500);
    const result = sanitizeNeoError(long);
    expect(result!.length).toBeLessThanOrEqual(301);
  });
});

describe("neoError", () => {
  it("produces a neutral pt-BR message per type with the matching HTTP status", () => {
    expect(neoError("configuration").message).toBe("O Neo ainda não está configurado.");
    expect(neoError("configuration").httpStatus).toBe(503);
    expect(neoError("rate_limit").httpStatus).toBe(429);
    expect(neoError("not_found").httpStatus).toBe(404);
  });

  it("allows a message override while keeping the type/status", () => {
    const err = neoError("validation", "Mensagem customizada");
    expect(err.type).toBe("validation");
    expect(err.message).toBe("Mensagem customizada");
  });
});

describe("normalizeThrownError", () => {
  it("maps a NeoConfigurationError to a configuration error", () => {
    expect(normalizeThrownError(new NeoConfigurationError()).type).toBe("configuration");
  });

  it("maps common HTTP-like statuses on thrown SDK errors", () => {
    expect(normalizeThrownError({ status: 401 }).type).toBe("authorization");
    expect(normalizeThrownError({ status: 404 }).type).toBe("not_found");
    expect(normalizeThrownError({ status: 429 }).type).toBe("rate_limit");
    expect(normalizeThrownError({ status: 500 }).type).toBe("provider_error");
  });

  it("maps an AbortError to a timeout", () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    expect(normalizeThrownError(abortError).type).toBe("timeout");
  });

  it("falls back to unknown for anything else, never leaking the raw error", () => {
    const result = normalizeThrownError(new Error("some internal detail with a stack trace"));
    expect(result.type).toBe("unknown");
    expect(result.message).not.toContain("stack trace");
  });
});
