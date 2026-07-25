import { describe, expect, it } from "vitest";
import { refreshEntityMemoryFromAnswer, summarizeEntityMemory, parseEntidadeMemoria } from "@/server/neo/entity-memory";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";
import type { NeoAnswer } from "@/lib/neo/answer";

function entidadeBloco(nome: string, cnpj: string): NeoAnswer["blocos"][number] {
  return {
    tipo: "entidade",
    nome,
    subtitulo: null,
    descricao: null,
    imagemUrl: null,
    identificadores: [{ rotulo: "CNPJ", valor: cnpj }],
    links: [],
    metricas: [],
    atributos: [],
    fontesIds: [],
  };
}

describe("entity-memory — preservação de CNPJs distintos", () => {
  it("never merges two entities with different CNPJs, even when they share the exact same rotulo", () => {
    const empresaA = entidadeBloco("Carango Comércio Ltda", "10.315.072/0001-81");
    const empresaB = entidadeBloco("Carango Comércio Ltda", "99.999.999/0001-00");

    let memoria = refreshEntityMemoryFromAnswer([], baseNeoAnswer({ blocos: [empresaA] }));
    memoria = refreshEntityMemoryFromAnswer(memoria, baseNeoAnswer({ blocos: [empresaB] }));

    const empresas = memoria.filter((e) => e.tipo === "empresa");
    expect(empresas).toHaveLength(2);
    expect(new Set(empresas.map((e) => e.identificador))).toEqual(new Set(["10315072000181", "99999999000100"]));
  });

  it("merges the same CNPJ across turns even when formatted differently, without duplicating the entity", () => {
    const semMascara = entidadeBloco("Carango", "10315072000181");
    const comMascara = entidadeBloco("Carango Comércio Ltda", "10.315.072/0001-81");

    let memoria = refreshEntityMemoryFromAnswer([], baseNeoAnswer({ blocos: [semMascara] }));
    memoria = refreshEntityMemoryFromAnswer(memoria, baseNeoAnswer({ blocos: [comMascara] }));

    const empresas = memoria.filter((e) => e.tipo === "empresa");
    expect(empresas).toHaveLength(1);
    // The richer label from the later turn wins, the identifier stays stable.
    expect(empresas[0].rotulo).toBe("Carango Comércio Ltda");
  });

  it("never auto-merges two same-tipo entities that both lack a canonical identifier, even with the same label", () => {
    const pessoa1: NeoAnswer["blocos"][number] = {
      tipo: "pessoa",
      nome: "Carlos Pereira",
      fotoUrl: null,
      papeis: [{ classificacao: "relacionado", nivelEvidencia: "indicio", evidencia: null, fontesIds: [] }],
      organizacoesRelacionadas: [],
      atributos: [],
      fontesIds: [],
    };
    let memoria = refreshEntityMemoryFromAnswer([], baseNeoAnswer({ blocos: [pessoa1] }));
    memoria = refreshEntityMemoryFromAnswer(memoria, baseNeoAnswer({ blocos: [pessoa1] }));
    // No identifier for a person -> every mention becomes its own entry (never guessed as "the same Carlos").
    expect(memoria.filter((e) => e.tipo === "pessoa")).toHaveLength(2);
  });

  it("links a pessoa bloco to the entidade bloco in the same relatório with a role-derived classification", () => {
    const empresa = entidadeBloco("Carango Comércio Ltda", "10.315.072/0001-81");
    const pessoa: NeoAnswer["blocos"][number] = {
      tipo: "pessoa",
      nome: "Fabio Rodrigo Bizetto",
      fotoUrl: null,
      papeis: [{ classificacao: "socio", nivelEvidencia: "confirmado", evidencia: "Quadro societário.", fontesIds: [] }],
      organizacoesRelacionadas: [],
      atributos: [],
      fontesIds: [],
    };
    const memoria = refreshEntityMemoryFromAnswer([], baseNeoAnswer({ blocos: [empresa, pessoa] }));
    const empresaEntry = memoria.find((e) => e.tipo === "empresa")!;
    const pessoaEntry = memoria.find((e) => e.tipo === "pessoa")!;
    expect(empresaEntry.vinculos.some((v) => v.entidadeId === pessoaEntry.id && v.classificacao === "vinculo_direto")).toBe(true);
    expect(pessoaEntry.vinculos.some((v) => v.entidadeId === empresaEntry.id && v.classificacao === "vinculo_direto")).toBe(true);
  });

  it("summarizes memory into a compact per-entity line usable in the next turn's context, including vínculos", () => {
    const empresa = entidadeBloco("Carango Comércio Ltda", "10.315.072/0001-81");
    const memoria = refreshEntityMemoryFromAnswer([], baseNeoAnswer({ blocos: [empresa] }));
    const resumo = summarizeEntityMemory(memoria);
    expect(resumo).toContain("empresa: Carango Comércio Ltda");
    expect(resumo).toContain("10315072000181");
  });

  it("parseEntidadeMemoria safely returns an empty array for anything that isn't valid entity memory", () => {
    expect(parseEntidadeMemoria(null)).toEqual([]);
    expect(parseEntidadeMemoria(undefined)).toEqual([]);
    expect(parseEntidadeMemoria("not an array")).toEqual([]);
    expect(parseEntidadeMemoria([{ bogus: true }])).toEqual([]);
  });
});
