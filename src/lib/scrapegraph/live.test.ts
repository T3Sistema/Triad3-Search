import { describe, expect, it } from "vitest";
import { sgaiRequest } from "./client";

/**
 * Opt-in tests that hit the real ScrapeGraphAI API. Skipped unless both
 * RUN_LIVE_TESTS=true and SGAI_API_KEY are set — `npm run test` never
 * spends real credits by default. When enabled, checks credits first and
 * performs at most one cheap Scrape (links only) against example.com.
 */
const isLive = process.env.RUN_LIVE_TESTS === "true" && Boolean(process.env.SGAI_API_KEY);

describe.skipIf(!isLive)("live ScrapeGraphAI API", () => {
  it("reads credits successfully", async () => {
    const result = await sgaiRequest("GET", "/credits");
    expect(result.ok).toBe(true);
  });

  it("performs a minimal scrape against example.com", async () => {
    const result = await sgaiRequest("POST", "/scrape", {
      body: { url: "https://example.com", formats: [{ type: "links" }] },
    });
    expect(result.ok).toBe(true);
  });
});
