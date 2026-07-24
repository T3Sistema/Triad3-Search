import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/services/pesquisar", () => ({ pesquisarWeb: vi.fn() }));

import "@/server/neo/tools/pesquisar";
import { getNeoTool } from "@/server/neo/tool-registry";
import { pesquisarWeb } from "@/server/services/pesquisar";

const ctx = { usuarioId: "u1", signal: new AbortController().signal };

describe("pesquisar_web tool", () => {
  beforeEach(() => vi.mocked(pesquisarWeb).mockReset());

  it("normalizes results and derives fontes from returned URLs", async () => {
    vi.mocked(pesquisarWeb).mockResolvedValue({
      ok: true,
      status: 200,
      durationMs: 5,
      data: { results: [{ url: "https://a.com", title: "A", content: "conteúdo" }] },
    });
    const tool = getNeoTool("pesquisar_web")!;
    const result = await tool.execute({ consulta: "teste", numeroResultados: null, intervaloTempo: null }, ctx);
    expect(result.ok).toBe(true);
    expect(result.fontes).toEqual([{ url: "https://a.com", titulo: "A", dominio: "a.com" }]);
  });

  it("reports empty results as an explicit missing-information note, not silence", async () => {
    vi.mocked(pesquisarWeb).mockResolvedValue({ ok: true, status: 200, durationMs: 5, data: { results: [] } });
    const tool = getNeoTool("pesquisar_web")!;
    const result = await tool.execute({ consulta: "algo raro", numeroResultados: null, intervaloTempo: null }, ctx);
    expect(result.ok).toBe(true);
    expect(result.informacoesAusentes.length).toBeGreaterThan(0);
  });

  it("propagates a service error as a neutral message", async () => {
    vi.mocked(pesquisarWeb).mockResolvedValue({
      ok: false,
      status: 429,
      durationMs: 5,
      error: { type: "rate_limit", message: "O limite temporário de requisições foi atingido. Tente novamente em instantes.", httpStatus: 429 },
    });
    const tool = getNeoTool("pesquisar_web")!;
    const result = await tool.execute({ consulta: "teste", numeroResultados: 5, intervaloTempo: "past_week" }, ctx);
    expect(result.ok).toBe(false);
    expect(result.erroPublico).toContain("limite temporário");
  });
});
