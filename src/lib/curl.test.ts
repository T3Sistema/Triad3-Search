import { describe, expect, it } from "vitest";
import { buildCurlPreview } from "./curl";

describe("buildCurlPreview", () => {
  it("targets only the internal neutral route", () => {
    const curl = buildCurlPreview("/api/triad3/capturar", { url: "https://example.com" });
    expect(curl).toContain('"/api/triad3/capturar"');
  });

  it("never reveals an external vendor domain", () => {
    const curl = buildCurlPreview("/api/triad3/capturar", { url: "https://example.com" });
    expect(curl).not.toContain("scrapegraphai");
    expect(curl).not.toMatch(/https?:\/\/v2-api/);
  });

  it("never includes a vendor auth header or a real key", () => {
    const curl = buildCurlPreview("/api/triad3/pesquisar", { query: "teste" });
    expect(curl).not.toContain("SGAI-APIKEY");
    expect(curl.toLowerCase()).not.toContain("sgai");
  });

  it("includes the request body as JSON when provided", () => {
    const curl = buildCurlPreview("/api/triad3/extrair", { prompt: "Extraia o título." });
    expect(curl).toContain("Extraia o título.");
  });
});
