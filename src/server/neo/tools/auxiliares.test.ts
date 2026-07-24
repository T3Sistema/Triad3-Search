import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/services/historico", () => ({ listarHistorico: vi.fn() }));
vi.mock("@/server/services/creditos", () => ({ consultarCreditos: vi.fn() }));

import "@/server/neo/tools/auxiliares";
import { getNeoTool, listNeoTools } from "@/server/neo/tool-registry";
import { listarHistorico } from "@/server/services/historico";
import { consultarCreditos } from "@/server/services/creditos";

const ctx = { usuarioId: "u1", signal: new AbortController().signal };

describe("consultar_historico / consultar_creditos tools", () => {
  beforeEach(() => {
    vi.mocked(listarHistorico).mockReset();
    vi.mocked(consultarCreditos).mockReset();
  });

  it("registers both auxiliary tools as read-only", () => {
    for (const tool of listNeoTools()) {
      expect(tool.persistent).toBe(false);
    }
    expect(listNeoTools().length).toBe(2);
  });

  it("consultar_historico normalizes a list result", async () => {
    vi.mocked(listarHistorico).mockResolvedValue({
      ok: true,
      status: 200,
      durationMs: 5,
      data: { data: [{ id: "h1", service: "scrape", status: "completed" }] },
    });
    const tool = getNeoTool("consultar_historico")!;
    const result = await tool.execute({ pagina: null, limite: null, servico: null }, ctx);
    expect(result.ok).toBe(true);
  });

  it("consultar_creditos accepts an empty object payload and normalizes the response", async () => {
    vi.mocked(consultarCreditos).mockResolvedValue({ ok: true, status: 200, durationMs: 5, data: { remaining: 100 } });
    const tool = getNeoTool("consultar_creditos")!;
    const result = await tool.execute({}, ctx);
    expect(result.ok).toBe(true);
  });
});
