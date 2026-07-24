import { describe, expect, it } from "vitest";
import { renderNeoAnswerPdf } from "./pdf";
import { NEO_ANSWER_VERSION, type NeoAnswer } from "@/lib/neo/answer";

function richAnswer(): NeoAnswer {
  return {
    version: NEO_ANSWER_VERSION,
    status: "completo",
    titulo: "Relatório de teste com acentuação: ç ã é",
    resumoExecutivo: "Resumo executivo.",
    blocos: [
      { tipo: "texto", titulo: "Seção", conteudo: "Conteúdo de teste.", fontesIds: [] },
      {
        tipo: "fatos",
        titulo: "Fatos",
        itens: [{ rotulo: "Nome", valor: "Ana", tipo: null, nivelEvidencia: "confirmado", dataObservacao: "2026-01-01", fontesIds: [] }],
      },
      { tipo: "tabela", titulo: "Tabela grande", colunas: ["A", "B"], linhas: Array.from({ length: 40 }, (_, i) => [`linha ${i}`, "valor"]), fontesIds: [], exportavelCsv: true },
      { tipo: "alerta", categoria: "resultado_parcial", mensagem: "Aviso de teste." },
      { tipo: "imagem", url: "https://example.com/imagem-inexistente.png", legenda: "Legenda", textoAlternativo: "alt", fontesIds: [] },
      { tipo: "fontes", itens: [{ id: "f1", titulo: "Fonte", url: "https://example.com", dominio: "example.com", dataAcesso: "2026-01-01" }] },
    ],
    fontes: [{ id: "f1", titulo: "Fonte", url: "https://example.com", dominio: "example.com", dataAcesso: "2026-01-01" }],
    informacoesAusentes: ["Campo ausente"],
    observacoes: ["Observação"],
    proximasAcoes: [],
    perguntaNecessaria: null,
  };
}

describe("renderNeoAnswerPdf", () => {
  it("produces a real, non-empty PDF buffer", async () => {
    const buf = await renderNeoAnswerPdf(richAnswer(), { perguntaOriginal: "Pergunta original", usuarioNome: "Usuário Teste", geradoEm: "24/07/2026 10:00" });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("handles a large table (many rows) without throwing", async () => {
    await expect(
      renderNeoAnswerPdf(richAnswer(), { perguntaOriginal: "p", usuarioNome: "u", geradoEm: "d" }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("skips an invalid image URL instead of crashing the render", async () => {
    const answer: NeoAnswer = { ...richAnswer(), blocos: [{ tipo: "imagem", url: "javascript:alert(1)", legenda: null, textoAlternativo: "alt", fontesIds: [] }] };
    const buf = await renderNeoAnswerPdf(answer, { perguntaOriginal: "p", usuarioNome: "u", geradoEm: "d" });
    expect(buf.length).toBeGreaterThan(0);
  });

  it("never embeds a vendor/model identifier in the report content", async () => {
    const buf = await renderNeoAnswerPdf(richAnswer(), { perguntaOriginal: "p", usuarioNome: "u", geradoEm: "d" });
    // PDF text streams may be compressed, so this checks the small set of
    // literal strings we control (title/meta), not a full-text extraction.
    const text = buf.toString("latin1");
    expect(text).not.toContain("gpt-5.4-mini");
  });
});
