import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/services/monitorar", () => ({
  criarMonitoramento: vi.fn(),
  listarMonitoramentos: vi.fn(),
  consultarMonitoramento: vi.fn(),
  atualizarMonitoramento: vi.fn(),
  excluirMonitoramento: vi.fn(),
  pausarMonitoramento: vi.fn(),
  retomarMonitoramento: vi.fn(),
  consultarAtividadesMonitoramento: vi.fn(),
}));

import "@/server/neo/tools/monitorar";
import { getNeoTool, isNeoToolPersistent, listNeoTools } from "@/server/neo/tool-registry";
import { criarMonitoramento, excluirMonitoramento } from "@/server/services/monitorar";

const ctx = { usuarioId: "u1", signal: new AbortController().signal };

describe("monitor_* tools", () => {
  beforeEach(() => {
    vi.mocked(criarMonitoramento).mockReset();
    vi.mocked(excluirMonitoramento).mockReset();
  });

  it("registers all eight monitor tools", () => {
    expect(listNeoTools().length).toBe(8);
  });

  it("flags exactly the five mutating monitor tools as persistent", () => {
    for (const name of ["monitor_criar", "monitor_atualizar", "monitor_pausar", "monitor_retomar", "monitor_excluir"]) {
      expect(isNeoToolPersistent(name)).toBe(true);
    }
    for (const name of ["monitor_listar", "monitor_status", "monitor_atividades"]) {
      expect(isNeoToolPersistent(name)).toBe(false);
    }
  });

  it("monitor_criar rejects an invalid cron interval before calling the service", async () => {
    const tool = getNeoTool("monitor_criar")!;
    const result = await tool.execute({ nome: "Teste", url: "https://example.com", intervaloCron: "não é cron", webhookUrl: null }, ctx);
    expect(result.ok).toBe(false);
    expect(criarMonitoramento).not.toHaveBeenCalled();
  });

  it("monitor_criar rejects a non-http URL", async () => {
    const tool = getNeoTool("monitor_criar")!;
    const result = await tool.execute({ nome: "Teste", url: "javascript:alert(1)", intervaloCron: "0 * * * *", webhookUrl: null }, ctx);
    expect(result.ok).toBe(false);
    expect(criarMonitoramento).not.toHaveBeenCalled();
  });

  it("monitor_criar calls the service with validated arguments when everything is valid", async () => {
    vi.mocked(criarMonitoramento).mockResolvedValue({
      ok: true,
      status: 201,
      durationMs: 5,
      data: { cronId: "m1", name: "Teste", url: "https://example.com", status: "active" },
    });
    const tool = getNeoTool("monitor_criar")!;
    const result = await tool.execute({ nome: "Teste", url: "https://example.com", intervaloCron: "0 * * * *", webhookUrl: null }, ctx);
    expect(result.ok).toBe(true);
    expect(criarMonitoramento).toHaveBeenCalledWith(expect.objectContaining({ name: "Teste", url: "https://example.com", interval: "0 * * * *" }));
  });

  it("monitor_excluir calls the service and returns a minimal confirmation summary", async () => {
    vi.mocked(excluirMonitoramento).mockResolvedValue({ ok: true, status: 200, durationMs: 5, data: { ok: true } });
    const tool = getNeoTool("monitor_excluir")!;
    const result = await tool.execute({ monitoramentoId: "m1" }, ctx);
    expect(result.ok).toBe(true);
    expect(excluirMonitoramento).toHaveBeenCalledWith("m1");
  });
});
