import { describe, expect, it } from "vitest";
import {
  crawlRequestSchema,
  cronSchema,
  extractRequestSchema,
  monitorCreateRequestSchema,
  scrapeRequestSchema,
  searchRequestSchema,
} from "./schemas";

describe("scrapeRequestSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = scrapeRequestSchema.safeParse({
      url: "https://example.com",
      formats: [{ type: "markdown", mode: "normal" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-http(s) URLs", () => {
    const result = scrapeRequestSchema.safeParse({
      url: "ftp://example.com",
      formats: [{ type: "links" }],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one format", () => {
    const result = scrapeRequestSchema.safeParse({ url: "https://example.com", formats: [] });
    expect(result.success).toBe(false);
  });

  it("requires a prompt when the json format is selected", () => {
    const result = scrapeRequestSchema.safeParse({
      url: "https://example.com",
      formats: [{ type: "json" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("extractRequestSchema", () => {
  it("accepts exactly one source (url)", () => {
    const result = extractRequestSchema.safeParse({ url: "https://example.com", prompt: "Extraia o título." });
    expect(result.success).toBe(true);
  });

  it("rejects when no source is provided", () => {
    const result = extractRequestSchema.safeParse({ prompt: "Extraia o título." });
    expect(result.success).toBe(false);
  });

  it("rejects when more than one source is provided", () => {
    const result = extractRequestSchema.safeParse({
      url: "https://example.com",
      html: "<p>oi</p>",
      prompt: "Extraia o título.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fetchConfig when the source is not a URL", () => {
    const result = extractRequestSchema.safeParse({
      markdown: "# Título",
      prompt: "Extraia o título.",
      fetchConfig: { mode: "auto" },
    });
    expect(result.success).toBe(false);
  });
});

describe("searchRequestSchema", () => {
  it("accepts a simple query", () => {
    const result = searchRequestSchema.safeParse({ query: "inteligência artificial" });
    expect(result.success).toBe(true);
  });

  it("rejects a schema without a prompt", () => {
    const result = searchRequestSchema.safeParse({
      query: "empresas de IA",
      schema: { type: "object" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects numResults outside the 1-20 range", () => {
    const result = searchRequestSchema.safeParse({ query: "teste", numResults: 25 });
    expect(result.success).toBe(false);
  });
});

describe("crawlRequestSchema", () => {
  it("applies default values", () => {
    const result = crawlRequestSchema.parse({
      url: "https://example.com",
      formats: [{ type: "links" }],
    });
    expect(result.maxPages).toBe(50);
    expect(result.maxDepth).toBe(2);
    expect(result.maxLinksPerPage).toBe(10);
    expect(result.allowExternal).toBe(false);
  });

  it("rejects maxPages above 1000", () => {
    const result = crawlRequestSchema.safeParse({
      url: "https://example.com",
      formats: [{ type: "links" }],
      maxPages: 5000,
    });
    expect(result.success).toBe(false);
  });
});

describe("cronSchema", () => {
  it("accepts a valid 5-field cron", () => {
    expect(cronSchema.safeParse("*/30 * * * *").success).toBe(true);
  });

  it("rejects a cron with the wrong number of fields", () => {
    expect(cronSchema.safeParse("*/30 * * *").success).toBe(false);
  });
});

describe("monitorCreateRequestSchema", () => {
  it("accepts a valid monitor payload", () => {
    const result = monitorCreateRequestSchema.safeParse({
      name: "Meu monitor",
      url: "https://example.com",
      interval: "0 9 * * *",
      formats: [{ type: "markdown" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid cron interval", () => {
    const result = monitorCreateRequestSchema.safeParse({
      name: "Meu monitor",
      url: "https://example.com",
      interval: "not-a-cron",
      formats: [{ type: "markdown" }],
    });
    expect(result.success).toBe(false);
  });
});
