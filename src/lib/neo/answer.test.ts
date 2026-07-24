import { describe, expect, it } from "vitest";
import { neoAnswerSchema, buildFallbackAnswer, normalizeNeoAnswer, NEO_ANSWER_VERSION, NEO_ANSWER_VERSION_1 } from "./answer";
import { baseNeoAnswer } from "./answer-fixtures";

describe("neoAnswerSchema (v2)", () => {
  it("accepts a well-formed answer", () => {
    expect(neoAnswerSchema.safeParse(baseNeoAnswer()).success).toBe(true);
  });

  it("accepts a rich answer covering the new v2 fields and block types", () => {
    const answer = baseNeoAnswer({
      indicadoresPrincipais: [{ rotulo: "CNPJ", valor: "00.000.000/0001-00", descricao: null, fontesIds: ["f1"] }],
      achados: [{ conclusao: "A empresa está ativa.", explicacao: "Situação cadastral confirmada na fonte oficial.", nivelEvidencia: "confirmado", fontesIds: ["f1"] }],
      lacunas: [{ tipo: "nao_encontrado", descricao: "Telefone de contato" }],
      matrizEvidencias: [{ conclusao: "A empresa está ativa.", evidencia: "Fonte oficial", classificacao: "confirmado" }],
      blocos: [
        {
          tipo: "pessoa",
          nome: "Ana Souza",
          fotoUrl: null,
          papeis: [{ classificacao: "socio", nivelEvidencia: "bem_sustentado", evidencia: "Contrato social", fontesIds: ["f1"] }],
          organizacoesRelacionadas: [{ nome: "Empresa X", relacao: "Sócia", fontesIds: ["f1"] }],
          atributos: [],
          fontesIds: ["f1"],
        },
        {
          tipo: "perfil_social",
          nome: "Empresa X",
          arroba: "@empresax",
          bio: "Loja oficial",
          url: "https://social.example/empresax",
          fotoUrl: null,
          seguidores: "12,3 mil",
          seguindo: "120",
          publicacoes: "340",
          relacao: "Perfil oficial da empresa pesquisada",
          metricaVariavel: true,
          dataObservacao: "2026-01-01",
          fontesIds: ["f1"],
        },
        {
          tipo: "publicacao",
          midiaUrl: "https://social.example/post.jpg",
          legenda: "Lançamento do produto",
          dataPublicacao: "2026-01-01",
          curtidas: "1,2 mil",
          comentarios: "45",
          outrasMetricas: [],
          contexto: "Publicação sobre o novo produto",
          url: "https://social.example/post",
          fontesIds: ["f1"],
        },
      ],
      fontes: [{ id: "f1", titulo: "Fonte", url: "https://example.com", dominio: "example.com", dataAcesso: "2026-01-01" }],
    });
    expect(neoAnswerSchema.safeParse(answer).success).toBe(true);
  });

  it("rejects an invalid nivelEvidencia value (never let an unknown confidence label through)", () => {
    const answer = baseNeoAnswer({
      achados: [{ conclusao: "x", explicacao: "y", nivelEvidencia: "muito_confiavel" as unknown as "confirmado", fontesIds: [] }],
    });
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("rejects an unknown block type", () => {
    const answer = baseNeoAnswer({ blocos: [{ tipo: "video", url: "https://example.com/v.mp4" } as never] });
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("no longer accepts an inline 'fontes' block (sources only belong in the top-level collapsed section)", () => {
    const answer = baseNeoAnswer({ blocos: [{ tipo: "fontes", itens: [] } as never] });
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("rejects a wrong schema version", () => {
    const answer = { ...baseNeoAnswer(), version: 1 as unknown as typeof NEO_ANSWER_VERSION };
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("requires status to be one of the three known values", () => {
    const answer = { ...baseNeoAnswer(), status: "em_andamento" as unknown as "completo" };
    expect(neoAnswerSchema.safeParse(answer).success).toBe(false);
  });

  it("never labels a person as owner directly — classification is an enum tied to evidence, not a boolean flag", () => {
    const answer = baseNeoAnswer({
      blocos: [
        {
          tipo: "pessoa",
          nome: "Carlos",
          fotoUrl: null,
          papeis: [{ classificacao: "relacionado", nivelEvidencia: "indicio", evidencia: null, fontesIds: [] }],
          organizacoesRelacionadas: [],
          atributos: [],
          fontesIds: [],
        },
      ],
    });
    const parsed = neoAnswerSchema.safeParse(answer);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const pessoa = parsed.data.blocos[0];
      expect(pessoa.tipo === "pessoa" && pessoa.papeis[0].classificacao).toBe("relacionado");
    }
  });
});

describe("buildFallbackAnswer", () => {
  it("always produces a schema-valid answer, even as a last-resort fallback", () => {
    const fallback = buildFallbackAnswer("Não foi possível montar o relatório.");
    expect(neoAnswerSchema.safeParse(fallback).success).toBe(true);
    expect(fallback.status).toBe("nao_concluido");
  });
});

describe("normalizeNeoAnswer", () => {
  it("returns a v2 answer unchanged when it already validates", () => {
    const answer = baseNeoAnswer({ titulo: "Já em v2" });
    expect(normalizeNeoAnswer(answer)).toEqual(answer);
  });

  it("upgrades an old v1 conversation (resumoExecutivo/informacoesAusentes) into the v2 shape", () => {
    const v1 = {
      version: NEO_ANSWER_VERSION_1,
      status: "completo" as const,
      titulo: "Relatório antigo",
      resumoExecutivo: "Resumo antigo do Neo.",
      blocos: [
        { tipo: "texto" as const, titulo: null, conteudo: "Conteúdo antigo.", fontesIds: [] },
        {
          tipo: "entidade" as const,
          nome: "Empresa Antiga",
          subtitulo: null,
          descricao: null,
          imagemUrl: null,
          identificadores: [{ rotulo: "CNPJ", valor: "00.000.000/0001-00" }],
          links: [],
          metricas: [],
          atributos: [{ rotulo: "Situação", valor: "Ativa" }],
          fontesIds: ["f1"],
        },
        { tipo: "fontes" as const, itens: [{ id: "f2", titulo: "Fonte extra só no bloco", url: "https://extra.example", dominio: "extra.example", dataAcesso: null }] },
      ],
      fontes: [{ id: "f1", titulo: "Fonte", url: "https://example.com", dominio: "example.com", dataAcesso: "2025-01-01" }],
      informacoesAusentes: ["Telefone"],
      observacoes: ["obs"],
      proximasAcoes: ["ação"],
      perguntaNecessaria: null,
    };

    const upgraded = normalizeNeoAnswer(v1);
    expect(upgraded.version).toBe(NEO_ANSWER_VERSION);
    expect(upgraded.titulo).toBe("Relatório antigo");
    expect(upgraded.respostaDireta).toBe("Resumo antigo do Neo.");
    expect(upgraded.lacunas).toEqual([{ tipo: "nao_encontrado", descricao: "Telefone" }]);
    // The inline "fontes" block is merged into the top-level list instead of duplicated as a visible block.
    expect(upgraded.blocos.every((b) => b.tipo !== ("fontes" as never))).toBe(true);
    expect(upgraded.fontes.map((f) => f.url)).toContain("https://extra.example");
    const entidade = upgraded.blocos.find((b) => b.tipo === "entidade");
    expect(entidade && entidade.tipo === "entidade" ? entidade.atributos[0].nivelEvidencia : null).toBe("bem_sustentado");
    expect(neoAnswerSchema.safeParse(upgraded).success).toBe(true);
  });

  it("falls back to a safe minimal report for completely unparseable data — never throws, never shows raw JSON", () => {
    const result = normalizeNeoAnswer({ nonsense: true });
    expect(neoAnswerSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe("nao_concluido");
  });

  it("handles null/undefined input without throwing", () => {
    expect(() => normalizeNeoAnswer(null)).not.toThrow();
    expect(() => normalizeNeoAnswer(undefined)).not.toThrow();
  });
});
