import { describe, expect, it } from "vitest";
import { asScreenshotUrl, asStringArray, asText } from "./render-helpers";

/**
 * The neutrality policy forbids the app's own UI text from naming vendors —
 * it never applies to content the user themselves fetched or searched for.
 * These tests prove the rendering helpers pass such content through
 * untouched, even when it happens to mention a company or vendor name.
 */
describe("asText — never censors legitimate user-fetched content", () => {
  it("passes through a string containing a company name unchanged", () => {
    const scraped = "Acme Corp partnered with ScrapeGraphAI and OtherVendor Inc. this year.";
    expect(asText(scraped)).toBe(scraped);
  });

  it("joins array content without altering any company/vendor names", () => {
    const scraped = ["Página da empresa ScrapeGraphAI", "Fornecedor: OtherVendor Ltda."];
    const result = asText(scraped);
    expect(result).toContain("ScrapeGraphAI");
    expect(result).toContain("OtherVendor Ltda.");
  });
});

describe("asStringArray — never censors legitimate user-fetched links", () => {
  it("keeps vendor-named URLs intact", () => {
    const links = ["https://scrapegraphai.com/pricing", "https://othervendor.com"];
    expect(asStringArray(links)).toEqual(links);
  });
});

describe("asScreenshotUrl — never rewrites the returned URL", () => {
  it("returns the URL exactly as provided", () => {
    expect(asScreenshotUrl({ url: "https://cdn.example-vendor.com/shot.png" })).toBe(
      "https://cdn.example-vendor.com/shot.png",
    );
  });
});
