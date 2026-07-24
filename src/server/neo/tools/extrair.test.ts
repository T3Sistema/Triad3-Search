import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/services/extrair", () => ({ extrairDados: vi.fn() }));

import "@/server/neo/tools/extrair";
import { getNeoTool } from "@/server/neo/tool-registry";
import { extrairDados } from "@/server/services/extrair";

const ctx = { usuarioId: "u1", signal: new AbortController().signal };

describe("extrair_dados tool", () => {
  beforeEach(() => vi.mocked(extrairDados).mockReset());

  it("rejects when neither url nor markdown is provided", async () => {
    const tool = getNeoTool("extrair_dados")!;
    const result = await tool.execute({ url: null, markdown: null, instrucao: "extraia o preço", campos: [] }, ctx);
    expect(result.ok).toBe(false);
    expect(extrairDados).not.toHaveBeenCalled();
  });

  it("rejects when both url and markdown are provided (exactly one source allowed)", async () => {
    const tool = getNeoTool("extrair_dados")!;
    const result = await tool.execute({ url: "https://example.com", markdown: "# a", instrucao: "extraia", campos: [] }, ctx);
    expect(result.ok).toBe(false);
    expect(extrairDados).not.toHaveBeenCalled();
  });

  it("rejects a non-http URL source", async () => {
    const tool = getNeoTool("extrair_dados")!;
    const result = await tool.execute({ url: "file:///etc/passwd", markdown: null, instrucao: "extraia", campos: [] }, ctx);
    expect(result.ok).toBe(false);
    expect(extrairDados).not.toHaveBeenCalled();
  });

  it("appends requested fields to the prompt and normalizes a successful extraction", async () => {
    vi.mocked(extrairDados).mockResolvedValue({ ok: true, status: 200, durationMs: 5, data: { id: "1", json: { preco: "R$ 10" } } });
    const tool = getNeoTool("extrair_dados")!;
    const result = await tool.execute({ url: "https://example.com", markdown: null, instrucao: "extraia", campos: ["preco"] }, ctx);
    expect(result.ok).toBe(true);
    expect(extrairDados).toHaveBeenCalledWith(expect.objectContaining({ prompt: expect.stringContaining("preco") }));
  });
});
