import { describe, expect, it } from "vitest";
import { NEO_TOOL_NAMES } from "@/server/neo/tool-names";
import { getToolCatalogEntry, listToolCatalog, buildToolCatalogPromptSection } from "@/server/neo/tool-catalog";

describe("tool catalog", () => {
  it("has one complete entry for every registered tool name — never falls back to a generic description", () => {
    for (const nome of NEO_TOOL_NAMES) {
      const entry = getToolCatalogEntry(nome);
      expect(entry, `missing catalog entry for ${nome}`).toBeDefined();
      expect(entry.nome).toBe(nome);
      expect(entry.finalidade.length).toBeGreaterThan(0);
      expect(entry.quandoUsar.length).toBeGreaterThan(0);
      expect(entry.quandoNaoUsar.length).toBeGreaterThan(0);
      expect(entry.exemplos.length).toBeGreaterThan(0);
    }
  });

  it("lists every tool exactly once, in NEO_TOOL_NAMES order", () => {
    expect(listToolCatalog().map((e) => e.nome)).toEqual([...NEO_TOOL_NAMES]);
  });

  it("marks every persistent (monitor mutation) tool as requiring confirmation in its rendered section", () => {
    const section = buildToolCatalogPromptSection();
    for (const nome of ["monitor_criar", "monitor_atualizar", "monitor_pausar", "monitor_retomar", "monitor_excluir"]) {
      const entryBlock = section.slice(section.indexOf(`### ${nome} `));
      expect(entryBlock).toMatch(/Requer confirmação explícita do usuário/);
    }
  });

  it("never requires confirmation for a read-only tool", () => {
    const section = buildToolCatalogPromptSection();
    for (const nome of ["pesquisar_web", "capturar_pagina", "extrair_dados", "monitor_listar", "consultar_historico", "consultar_creditos"]) {
      const start = section.indexOf(`### ${nome} `);
      const end = section.indexOf("\n\n### ", start + 1);
      const entryBlock = section.slice(start, end === -1 ? undefined : end);
      expect(entryBlock).not.toMatch(/Requer confirmação explícita do usuário/);
    }
  });
});
