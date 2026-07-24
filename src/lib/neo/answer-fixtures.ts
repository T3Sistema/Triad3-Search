import { NEO_ANSWER_VERSION, type NeoAnswer } from "@/lib/neo/answer";

/** Minimal, schema-valid v2 NeoAnswer used across export/component tests — overrides merge shallowly. */
export function baseNeoAnswer(overrides: Partial<NeoAnswer> = {}): NeoAnswer {
  return {
    version: NEO_ANSWER_VERSION,
    status: "completo",
    titulo: "Relatório de teste",
    objetivo: "Objetivo de teste.",
    indicadoresPrincipais: [],
    achados: [],
    respostaDireta: "Resposta direta de teste.",
    blocos: [],
    lacunas: [],
    matrizEvidencias: [],
    fontes: [],
    observacoes: [],
    proximasAcoes: [],
    perguntaNecessaria: null,
    ...overrides,
  };
}
