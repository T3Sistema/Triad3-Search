import { describe, expect, it } from "vitest";
import { neoAgentTurnSchema, neoResumoConversaSchema, neoTituloConversaSchema } from "./schemas";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

describe("neoAgentTurnSchema", () => {
  it("accepts a plain conversational reply", () => {
    expect(neoAgentTurnSchema.safeParse({ tipo: "resposta", texto: "Até agora encontrei o CNPJ e o Instagram oficial." }).success).toBe(true);
  });

  it("accepts a clarifying question", () => {
    expect(neoAgentTurnSchema.safeParse({ tipo: "pergunta", texto: "Você está falando da empresa de Maceió ou do domínio carango.com.br?" }).success).toBe(true);
  });

  it("accepts an inline clarification form", () => {
    const turno = {
      tipo: "formulario",
      formulario: {
        titulo: "Configurar monitoramento",
        explicacao: "Preciso de mais alguns dados antes de criar o monitoramento.",
        campos: [
          { id: "url", rotulo: "URL a monitorar", descricao: null, tipo: "url", obrigatorio: true, valorSugerido: null, opcoes: [] },
          { id: "frequencia", rotulo: "Frequência", descricao: null, tipo: "selecao", obrigatorio: true, valorSugerido: "diaria", opcoes: [{ valor: "diaria", rotulo: "Diária" }] },
        ],
        acaoConfirmacao: "Iniciar monitoramento",
      },
    };
    expect(neoAgentTurnSchema.safeParse(turno).success).toBe(true);
  });

  it("accepts a final consolidated relatório (NeoAnswer v2)", () => {
    const turno = { tipo: "relatorio", relatorio: baseNeoAnswer() };
    expect(neoAgentTurnSchema.safeParse(turno).success).toBe(true);
  });

  it("rejects a turno with an unknown tipo", () => {
    expect(neoAgentTurnSchema.safeParse({ tipo: "outro", texto: "x" }).success).toBe(false);
  });

  it("rejects a resposta turno missing texto", () => {
    expect(neoAgentTurnSchema.safeParse({ tipo: "resposta" }).success).toBe(false);
  });
});

describe("neoResumoConversaSchema / neoTituloConversaSchema", () => {
  it("accept their minimal shapes", () => {
    expect(neoResumoConversaSchema.safeParse({ resumo: "Resumo da análise em andamento." }).success).toBe(true);
    expect(neoTituloConversaSchema.safeParse({ titulo: "Análise sobre a Empresa X" }).success).toBe(true);
  });
});
