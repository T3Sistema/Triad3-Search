import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/services/mapear", () => ({
  iniciarMapeamento: vi.fn(),
  consultarMapeamento: vi.fn(),
  listarPaginasMapeamento: vi.fn(),
  interromperMapeamento: vi.fn(),
  retomarMapeamento: vi.fn(),
}));

import "@/server/neo/tools/mapear";
import { getNeoTool, listNeoTools } from "@/server/neo/tool-registry";
import { iniciarMapeamento, consultarMapeamento } from "@/server/services/mapear";

const ctx = { usuarioId: "u1", signal: new AbortController().signal };

describe("mapear_* tools", () => {
  beforeEach(() => {
    vi.mocked(iniciarMapeamento).mockReset();
    vi.mocked(consultarMapeamento).mockReset();
  });

  it("registers all five mapping tools (iniciar, status, paginas, interromper, retomar)", () => {
    const names = listNeoTools().map((t) => t.name).sort();
    expect(names).toEqual(["mapear_iniciar", "mapear_interromper", "mapear_paginas", "mapear_retomar", "mapear_status"].sort());
  });

  it("mapear_iniciar rejects a non-http URL", async () => {
    const tool = getNeoTool("mapear_iniciar")!;
    const result = await tool.execute({ url: "ftp://example.com", maxPaginas: null, maxProfundidade: null }, ctx);
    expect(result.ok).toBe(false);
    expect(iniciarMapeamento).not.toHaveBeenCalled();
  });

  it("mapear_iniciar applies sane defaults when limits are omitted", async () => {
    vi.mocked(iniciarMapeamento).mockResolvedValue({ ok: true, status: 200, durationMs: 5, data: { id: "c1", status: "running" } });
    const tool = getNeoTool("mapear_iniciar")!;
    await tool.execute({ url: "https://example.com", maxPaginas: null, maxProfundidade: null }, ctx);
    expect(iniciarMapeamento).toHaveBeenCalledWith(expect.objectContaining({ maxPages: 30, maxDepth: 2 }));
  });

  it("mapear_status normalizes a crawl status result, including page count", async () => {
    vi.mocked(consultarMapeamento).mockResolvedValue({
      ok: true,
      status: 200,
      durationMs: 5,
      data: { id: "c1", status: "completed", total: 2, finished: 2, pages: [{ url: "https://example.com/a" }] },
    });
    const tool = getNeoTool("mapear_status")!;
    const result = await tool.execute({ mapeamentoId: "c1" }, ctx);
    expect(result.ok).toBe(true);
    expect(result.fontes[0]?.url).toBe("https://example.com/a");
  });
});
