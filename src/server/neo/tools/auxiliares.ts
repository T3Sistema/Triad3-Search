import "server-only";
import { z } from "zod";
import { registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { listarHistorico } from "@/server/services/historico";
import { consultarCreditos } from "@/server/services/creditos";
import { normalizeCreditos, normalizeHistoricoLista } from "@/server/neo/tool-normalizers";

function errorResult(erroPublico: string): NeoToolExecutionResult {
  return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico };
}

registerNeoTool({
  name: "consultar_historico",
  nomePublico: "Consultando histórico",
  description: "Consulta o histórico de requisições já realizadas pelo usuário, útil para reaproveitar um resultado recente em vez de repetir uma consulta idêntica.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: z.object({
    pagina: z.number().int().min(1).nullable(),
    limite: z.number().int().min(1).max(100).nullable(),
    servico: z.string().nullable(),
  }),
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await listarHistorico({ page: args.pagina ?? 1, limit: args.limite ?? 20, service: args.servico ?? undefined });
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeHistoricoLista(result.data) };
  },
});

registerNeoTool({
  name: "consultar_creditos",
  nomePublico: "Verificando disponibilidade",
  description: "Consulta os créditos/limites disponíveis no momento. Use apenas se relevante para decidir se uma investigação ampla é viável.",
  persistent: false,
  timeoutMs: 15_000,
  parameters: z.object({}),
  async execute(): Promise<NeoToolExecutionResult> {
    const result = await consultarCreditos();
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeCreditos(result.data) };
  },
});
