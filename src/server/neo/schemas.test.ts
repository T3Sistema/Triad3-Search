import { describe, expect, it } from "vitest";
import { neoPlanSchema, neoVerificacaoSchema, neoResumoConversaSchema, neoTituloConversaSchema } from "./schemas";

function validPlan() {
  return {
    objetivoInterpretado: "Reunir informações públicas sobre uma empresa.",
    ambiguidadeBloqueante: false,
    perguntaNecessaria: null,
    etapasPlanejadas: ["Localizar fontes", "Ler páginas relevantes"],
    dadosNecessarios: ["Site oficial", "Notícias recentes"],
    criteriosConclusao: ["Ao menos duas fontes confiáveis"],
    ferramentasProvaveis: ["pesquisar_web", "capturar_pagina"],
    execucaoParalelaPossivel: true,
    riscoConfusaoEntidades: null,
    camposSolicitados: ["site oficial", "notícias"],
    formatoRelatorioEsperado: "Perfil da empresa com fatos e fontes",
  };
}

describe("neoPlanSchema", () => {
  it("accepts a well-formed plan", () => {
    expect(neoPlanSchema.safeParse(validPlan()).success).toBe(true);
  });

  it("rejects a plan referencing a tool name outside the registry's known list", () => {
    const plan = { ...validPlan(), ferramentasProvaveis: ["excluir_banco_de_dados"] };
    expect(neoPlanSchema.safeParse(plan).success).toBe(false);
  });

  it("requires perguntaNecessaria to be present (string or explicit null), never omitted", () => {
    const { perguntaNecessaria, ...rest } = validPlan();
    void perguntaNecessaria;
    expect(neoPlanSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts a blocking-ambiguity plan with a follow-up question", () => {
    const plan = { ...validPlan(), ambiguidadeBloqueante: true, perguntaNecessaria: "Qual empresa, exatamente?" };
    expect(neoPlanSchema.safeParse(plan).success).toBe(true);
  });
});

describe("neoVerificacaoSchema", () => {
  it("accepts a well-formed verification result", () => {
    const result = neoVerificacaoSchema.safeParse({
      camposEncontrados: ["site oficial"],
      camposAusentes: ["telefone"],
      divergenciasDetectadas: [],
      necessitaNovaConsulta: false,
      motivoNovaConsulta: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("neoResumoConversaSchema / neoTituloConversaSchema", () => {
  it("accept their minimal shapes", () => {
    expect(neoResumoConversaSchema.safeParse({ resumo: "Resumo da investigação." }).success).toBe(true);
    expect(neoTituloConversaSchema.safeParse({ titulo: "Investigação sobre X" }).success).toBe(true);
  });
});
