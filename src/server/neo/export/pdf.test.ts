import { describe, expect, it } from "vitest";
import { renderNeoAnswerPdf } from "./pdf";
import type { NeoAnswer } from "@/lib/neo/answer";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

function richAnswer(): NeoAnswer {
  return baseNeoAnswer({
    titulo: "Relatório de teste com acentuação: ç ã é",
    indicadoresPrincipais: [{ rotulo: "Indicador", valor: "42", descricao: null, fontesIds: [] }],
    achados: [{ conclusao: "Achado principal", explicacao: "Explicação do achado.", nivelEvidencia: "confirmado", fontesIds: ["f1"] }],
    blocos: [
      { tipo: "texto", titulo: "Seção", conteudo: "Conteúdo de teste.", fontesIds: [] },
      {
        tipo: "fatos",
        titulo: "Fatos",
        itens: [{ rotulo: "Nome", valor: "Ana", tipo: null, nivelEvidencia: "confirmado", dataObservacao: "2026-01-01", fontesIds: [] }],
      },
      {
        tipo: "tabela",
        titulo: "Tabela grande",
        colunas: ["A", "B"],
        linhas: Array.from({ length: 40 }, (_, i) => [`linha ${i}`, "valor"]),
        fontesIds: [],
        exportavelCsv: true,
      },
      { tipo: "alerta", categoria: "resultado_parcial", mensagem: "Aviso de teste." },
      { tipo: "imagem", url: "https://example.com/imagem-inexistente.png", legenda: "Legenda", textoAlternativo: "alt", fontesIds: [] },
    ],
    fontes: [{ id: "f1", titulo: "Fonte", url: "https://example.com", dominio: "example.com", dataAcesso: "2026-01-01" }],
    lacunas: [{ tipo: "nao_encontrado", descricao: "Campo ausente" }],
    matrizEvidencias: [{ conclusao: "Achado principal", evidencia: "Fonte consultada", classificacao: "confirmado" }],
    observacoes: ["Observação"],
  });
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
