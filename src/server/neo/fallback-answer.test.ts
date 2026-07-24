import { describe, expect, it } from "vitest";
import { buildEvidenceFallbackAnswer, hasFallbackEvidence, summarizeToolResult } from "@/server/neo/fallback-answer";

describe("summarizeToolResult", () => {
  it("counts a known array field when present", () => {
    expect(summarizeToolResult({ resultados: [1, 2, 3] })).toContain("3");
  });

  it("falls back to a generic message when no known field is found", () => {
    expect(summarizeToolResult({ algoDesconhecido: true })).toBe("Etapa concluída.");
  });

  it("never throws on null/undefined resumo", () => {
    expect(summarizeToolResult(null)).toBe("Etapa concluída.");
    expect(summarizeToolResult(undefined)).toBe("Etapa concluída.");
  });
});

describe("hasFallbackEvidence", () => {
  it("is true when at least one step succeeded", () => {
    expect(hasFallbackEvidence([{ ferramenta: "pesquisar_web", nomePublico: "x", ok: true }], [])).toBe(true);
  });

  it("is true when at least one source was collected, even with zero successful steps", () => {
    expect(hasFallbackEvidence([], [{ url: "https://a.com" }])).toBe(true);
  });

  it("is false with nothing usable", () => {
    expect(hasFallbackEvidence([{ ferramenta: "pesquisar_web", nomePublico: "x", ok: false, erroPublico: "falhou" }], [])).toBe(false);
  });
});

describe("buildEvidenceFallbackAnswer — sem fatos concretos (NÃO CONCLUÍDO)", () => {
  it("reproduces the incident's shape (9 search calls, 0 extractions) — never turns step names or result counts into achados", () => {
    const etapas = Array.from({ length: 9 }, (_, i) => ({
      ferramenta: "pesquisar_web",
      nomePublico: "Pesquisando fontes",
      ok: true,
      resumo: { resultados: [{ url: `https://site${i}.com` }] },
    }));
    const answer = buildEvidenceFallbackAnswer({ motivo: "A execução foi interrompida.", etapas, fontes: [] });
    expect(answer.status).toBe("nao_concluido");
    expect(answer.achados).toEqual([]);
    expect(answer.matrizEvidencias).toEqual([]);
    expect(answer.indicadoresPrincipais).toEqual([]);
    expect(JSON.stringify(answer)).not.toContain("Pesquisando fontes");
    expect(JSON.stringify(answer)).not.toContain("resultado(s) encontrado(s)");
  });

  it("never fabricates a report when only a plain search call succeeded, even with sources collected", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [{ ferramenta: "pesquisar_web", nomePublico: "Pesquisando fontes", ok: true, resumo: { resultados: [{ url: "https://a.com" }] } }],
      fontes: [{ url: "https://a.com", titulo: "Página irrelevante" }],
    });
    expect(answer.status).toBe("nao_concluido");
    expect(answer.fontes).toEqual([]);
  });

  it("lists unresolved tracked objectives as lacunas, never mentioning a tool or step", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [],
      fontes: [],
      objetivos: [
        { descricao: "CNPJ", status: "nao_encontrado" },
        { descricao: "Instagram oficial", status: "encontrado" },
      ],
    });
    expect(answer.lacunas).toEqual([{ tipo: "nao_encontrado", descricao: "CNPJ" }]);
  });

  it("offers Tentar novamente / Ajustar solicitação semantics via nao_concluido status, never a fabricated matrix", () => {
    const answer = buildEvidenceFallbackAnswer({ motivo: "x", etapas: [], fontes: [] });
    expect(answer.status).toBe("nao_concluido");
    expect(answer.blocos).toEqual([]);
    expect(answer.proximasAcoes).toEqual([]);
  });
});

describe("buildEvidenceFallbackAnswer — com valores extraídos (PARCIAL)", () => {
  it("builds concrete achados/fatos/matrix only from a successful extrair_dados result", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [
        { ferramenta: "pesquisar_web", nomePublico: "Pesquisando fontes", ok: true, resumo: { resultados: [{ url: "https://empresarial.example/x" }] } },
        {
          ferramenta: "extrair_dados",
          nomePublico: "Extraindo informações",
          ok: true,
          resumo: { json: { cnpj: "12.345.678/0001-99", responsavel: "Fulano de Tal" } },
          argumentos: { url: "https://empresarial.example/x" },
        },
      ],
      fontes: [{ url: "https://empresarial.example/x", titulo: "Fonte", dominio: "empresarial.example" }],
    });
    expect(answer.status).toBe("parcial");
    expect(answer.achados.map((a) => a.conclusao)).toEqual(expect.arrayContaining([expect.stringContaining("12.345.678/0001-99"), expect.stringContaining("Fulano de Tal")]));
    expect(answer.blocos[0]).toMatchObject({ tipo: "fatos" });
    expect(answer.matrizEvidencias.length).toBe(2);
    expect(answer.indicadoresPrincipais.length).toBeGreaterThan(0);
    // Every achado/matrix entry uses the extracted value, never the tool name or a result count.
    expect(JSON.stringify(answer.achados)).not.toContain("Extraindo informações");
    expect(JSON.stringify(answer.achados)).not.toContain("Pesquisando fontes");
  });

  it("only counts the source actually behind an extraction as a fonte utilizada — an unrelated search result never counts", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [
        { ferramenta: "pesquisar_web", nomePublico: "Pesquisando fontes", ok: true, resumo: { resultados: [{ url: "https://irrelevante.example" }] } },
        {
          ferramenta: "extrair_dados",
          nomePublico: "Extraindo informações",
          ok: true,
          resumo: { json: { cnpj: "12.345.678/0001-99" } },
          argumentos: { url: "https://empresarial.example/x" },
        },
      ],
      fontes: [
        { url: "https://irrelevante.example", titulo: "Página sem relação" },
        { url: "https://empresarial.example/x", titulo: "Fonte cadastral" },
      ],
    });
    expect(answer.fontes).toHaveLength(1);
    expect(answer.fontes[0].url).toBe("https://empresarial.example/x");
  });

  it("never claims completo — a fallback report is always parcial when it has concrete facts", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [{ ferramenta: "extrair_dados", nomePublico: "Extraindo informações", ok: true, resumo: { json: { campo: "valor" } } }],
      fontes: [],
    });
    expect(answer.status).toBe("parcial");
  });

  it("suggests continuing only when a tracked objective is still unresolved", () => {
    const semLacuna = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [{ ferramenta: "extrair_dados", nomePublico: "Extraindo informações", ok: true, resumo: { json: { campo: "valor" } } }],
      fontes: [],
      objetivos: [{ descricao: "campo", status: "encontrado" }],
    });
    expect(semLacuna.proximasAcoes).toEqual([]);

    const comLacuna = buildEvidenceFallbackAnswer({
      motivo: "x",
      etapas: [{ ferramenta: "extrair_dados", nomePublico: "Extraindo informações", ok: true, resumo: { json: { campo: "valor" } } }],
      fontes: [],
      objetivos: [
        { descricao: "campo", status: "encontrado" },
        { descricao: "outro campo", status: "nao_encontrado" },
      ],
    });
    expect(comLacuna.proximasAcoes.length).toBeGreaterThan(0);
  });

  it("never lets a banned term through, even if the motivo string contains one", () => {
    const answer = buildEvidenceFallbackAnswer({
      motivo: "A investigação foi interrompida.",
      etapas: [],
      fontes: [],
    });
    expect(JSON.stringify(answer).toLowerCase()).not.toContain("investiga");
  });
});
