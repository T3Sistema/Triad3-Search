import { describe, expect, it } from "vitest";
import { sanitizeIntegrationError } from "./sanitize";

describe("sanitizeIntegrationError", () => {
  it("translates known infrastructure phrases into safe Portuguese", () => {
    expect(sanitizeIntegrationError("Unauthorized")).toBe("A integração não está configurada corretamente.");
    expect(sanitizeIntegrationError("Payment required")).toBe("Não há créditos suficientes para concluir a operação.");
    expect(sanitizeIntegrationError("Rate limit exceeded")).toBe(
      "O limite temporário de requisições foi atingido. Tente novamente em instantes.",
    );
    expect(sanitizeIntegrationError("Provider timeout after 30s")).toBe(
      "O serviço demorou mais que o esperado para responder.",
    );
    expect(sanitizeIntegrationError("Internal server error")).toBe("O serviço não conseguiu concluir a operação.");
  });

  it("drops messages that mention the vendor name", () => {
    expect(sanitizeIntegrationError("Unexpected failure from ScrapeGraphAI backend")).toBeUndefined();
    expect(sanitizeIntegrationError("SGAI request failed")).toBeUndefined();
  });

  it("drops messages that leak an auth header or token", () => {
    expect(sanitizeIntegrationError("Invalid SGAI-APIKEY provided")).toBeUndefined();
    expect(sanitizeIntegrationError("Missing Authorization header")).toBeUndefined();
    expect(sanitizeIntegrationError("Bearer token expired")).toBeUndefined();
  });

  it("strips external domains from otherwise-safe messages", () => {
    const result = sanitizeIntegrationError("Failed to reach api.example-vendor.com right now");
    expect(result).not.toContain("example-vendor.com");
  });

  it("passes through short, clean messages unchanged", () => {
    expect(sanitizeIntegrationError("Missing field: url")).toBe("Missing field: url");
  });

  it("returns undefined for empty input", () => {
    expect(sanitizeIntegrationError(undefined)).toBeUndefined();
    expect(sanitizeIntegrationError("")).toBeUndefined();
    expect(sanitizeIntegrationError("   ")).toBeUndefined();
  });

  it("never leaks the vendor name in its own output for any input", () => {
    const inputs = [
      "ScrapeGraphAI is down",
      "unauthorized: SGAI-APIKEY invalid for v2-api.scrapegraphai.com",
      "internal server error at v2-api.scrapegraphai.com",
    ];
    for (const input of inputs) {
      const result = sanitizeIntegrationError(input);
      if (result) {
        expect(result.toLowerCase()).not.toContain("scrapegraphai");
        expect(result.toLowerCase()).not.toMatch(/\bsgai\b/);
      }
    }
  });
});
