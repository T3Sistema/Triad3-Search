import { describe, expect, it } from "vitest";
import { ALL_NAV_ITEMS } from "./nav";

const KNOWN_ENGLISH_LEFTOVERS = ["Scrape", "Extract", "Search", "Crawl", "Monitor", "History", "Credits", "Documentation"];

describe("navigation labels", () => {
  it("never shows an untranslated English module name", () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(KNOWN_ENGLISH_LEFTOVERS).not.toContain(item.label);
    }
  });

  it("translates every module to the expected Portuguese label", () => {
    const labels = Object.fromEntries(ALL_NAV_ITEMS.map((item) => [item.key, item.label]));
    expect(labels.scrape).toBe("Capturar");
    expect(labels.extract).toBe("Extrair");
    expect(labels.search).toBe("Pesquisar");
    expect(labels.crawl).toBe("Mapear site");
    expect(labels.monitor).toBe("Monitorar");
    expect(labels.history).toBe("Histórico");
    expect(labels.docs).toBe("Ajuda");
  });

  it("keeps the Triad3 Search proper name untranslated wherever it appears in descriptions", () => {
    const withBrand = ALL_NAV_ITEMS.find((item) => item.description.includes("Triad3"));
    if (withBrand) {
      expect(withBrand.description).toContain("Triad3 Search");
    }
  });
});
