import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/services/capturar", () => ({ capturarPagina: vi.fn() }));

import "@/server/neo/tools/capturar";
import { getNeoTool } from "@/server/neo/tool-registry";
import { capturarPagina } from "@/server/services/capturar";

const ctx = { usuarioId: "u1", signal: new AbortController().signal };

describe("capturar_pagina tool", () => {
  beforeEach(() => vi.mocked(capturarPagina).mockReset());

  it("rejects a non-http URL without calling the service", async () => {
    const tool = getNeoTool("capturar_pagina")!;
    const result = await tool.execute({ url: "javascript:alert(1)", formatos: [] }, ctx);
    expect(result.ok).toBe(false);
    expect(result.erroPublico).toBeTruthy();
    expect(capturarPagina).not.toHaveBeenCalled();
  });

  it("defaults to markdown when no formats are requested, and normalizes a successful result", async () => {
    vi.mocked(capturarPagina).mockResolvedValue({
      ok: true,
      status: 200,
      durationMs: 10,
      data: { id: "1", status: "completed", results: { markdown: { data: "# Olá" } } },
    });
    const tool = getNeoTool("capturar_pagina")!;
    const result = await tool.execute({ url: "https://example.com", formatos: [] }, ctx);
    expect(result.ok).toBe(true);
    expect(capturarPagina).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com", formats: [{ type: "markdown" }] }));
    expect(result.fontes[0]?.url).toBe("https://example.com");
  });

  it("surfaces a neutral error message when the underlying service fails, without throwing", async () => {
    vi.mocked(capturarPagina).mockResolvedValue({
      ok: false,
      status: 504,
      durationMs: 10,
      error: { type: "timeout", message: "O serviço demorou mais que o esperado para responder.", httpStatus: 504 },
    });
    const tool = getNeoTool("capturar_pagina")!;
    const result = await tool.execute({ url: "https://example.com", formatos: ["markdown"] }, ctx);
    expect(result.ok).toBe(false);
    expect(result.erroPublico).toBe("O serviço demorou mais que o esperado para responder.");
  });
});
