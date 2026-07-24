import "server-only";
import { z } from "zod";
import { registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import {
  atualizarMonitoramento,
  consultarAtividadesMonitoramento,
  consultarMonitoramento,
  criarMonitoramento,
  excluirMonitoramento,
  listarMonitoramentos,
  pausarMonitoramento,
  retomarMonitoramento,
} from "@/server/services/monitorar";
import {
  normalizeMonitor,
  normalizeMonitorAtividades,
  normalizeMonitorLista,
} from "@/server/neo/tool-normalizers";
import { isHttpUrl } from "@/lib/url";
import { cronSchema } from "@/lib/integration/schemas";

function errorResult(erroPublico: string): NeoToolExecutionResult {
  return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico };
}

const monitorIdSchema = z.object({ monitoramentoId: z.string().min(1) });

const criarParamsSchema = z.object({
  nome: z.string().min(1).max(200),
  url: z.string().min(1),
  intervaloCron: z.string().min(1),
  webhookUrl: z.string().nullable(),
});

registerNeoTool({
  name: "monitor_criar",
  nomePublico: "Criando monitoramento",
  description:
    "Cria um acompanhamento periódico de mudanças em uma URL. AÇÃO PERSISTENTE — só é executada depois de confirmação explícita do usuário, nunca automaticamente. `intervaloCron` usa 5 campos (minuto hora dia mês dia-da-semana) em UTC.",
  persistent: true,
  timeoutMs: 30_000,
  parameters: criarParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    if (!isHttpUrl(args.url)) return errorResult("URL inválida ou não pública.");
    const cron = cronSchema.safeParse(args.intervaloCron);
    if (!cron.success) return errorResult("Intervalo cron inválido.");
    const result = await criarMonitoramento({
      name: args.nome,
      url: args.url,
      interval: cron.data,
      formats: [{ type: "markdown" }],
      webhookUrl: args.webhookUrl ?? undefined,
    });
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeMonitor(result.data) };
  },
});

registerNeoTool({
  name: "monitor_listar",
  nomePublico: "Consultando monitoramentos",
  description: "Lista os monitoramentos existentes do usuário, com status atual.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: z.object({
    pagina: z.number().int().min(1).nullable(),
    limite: z.number().int().min(1).max(100).nullable(),
    status: z.string().nullable(),
  }),
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await listarMonitoramentos({
      page: args.pagina ?? 1,
      limit: args.limite ?? 20,
      status: args.status ?? undefined,
    });
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeMonitorLista(result.data) };
  },
});

registerNeoTool({
  name: "monitor_status",
  nomePublico: "Verificando monitoramento",
  description: "Consulta o estado atual de um monitoramento específico.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: monitorIdSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await consultarMonitoramento(args.monitoramentoId);
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeMonitor(result.data) };
  },
});

registerNeoTool({
  name: "monitor_atualizar",
  nomePublico: "Editando monitoramento",
  description:
    "Atualiza nome, URL, intervalo ou webhook de um monitoramento existente. AÇÃO PERSISTENTE — só é executada depois de confirmação explícita do usuário.",
  persistent: true,
  timeoutMs: 30_000,
  parameters: z.object({
    monitoramentoId: z.string().min(1),
    nome: z.string().min(1).max(200).nullable(),
    url: z.string().nullable(),
    intervaloCron: z.string().nullable(),
    webhookUrl: z.string().nullable(),
  }),
  async execute(args): Promise<NeoToolExecutionResult> {
    if (args.url && !isHttpUrl(args.url)) return errorResult("URL inválida ou não pública.");
    if (args.intervaloCron) {
      const cron = cronSchema.safeParse(args.intervaloCron);
      if (!cron.success) return errorResult("Intervalo cron inválido.");
    }
    const result = await atualizarMonitoramento(args.monitoramentoId, {
      name: args.nome ?? undefined,
      url: args.url ?? undefined,
      interval: args.intervaloCron ?? undefined,
      webhookUrl: args.webhookUrl ?? undefined,
    });
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeMonitor(result.data) };
  },
});

registerNeoTool({
  name: "monitor_pausar",
  nomePublico: "Pausando monitoramento",
  description: "Pausa um monitoramento ativo. AÇÃO PERSISTENTE — só é executada depois de confirmação explícita do usuário.",
  persistent: true,
  timeoutMs: 20_000,
  parameters: monitorIdSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await pausarMonitoramento(args.monitoramentoId);
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeMonitor(result.data) };
  },
});

registerNeoTool({
  name: "monitor_retomar",
  nomePublico: "Retomando monitoramento",
  description: "Retoma um monitoramento pausado. AÇÃO PERSISTENTE — só é executada depois de confirmação explícita do usuário.",
  persistent: true,
  timeoutMs: 20_000,
  parameters: monitorIdSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await retomarMonitoramento(args.monitoramentoId);
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeMonitor(result.data) };
  },
});

registerNeoTool({
  name: "monitor_excluir",
  nomePublico: "Excluindo monitoramento",
  description: "Exclui definitivamente um monitoramento. AÇÃO PERSISTENTE — só é executada depois de confirmação explícita do usuário.",
  persistent: true,
  timeoutMs: 20_000,
  parameters: monitorIdSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await excluirMonitoramento(args.monitoramentoId);
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, resumo: { excluido: true }, fontes: [], parcial: false, informacoesAusentes: [] };
  },
});

registerNeoTool({
  name: "monitor_atividades",
  nomePublico: "Consultando atividade do monitoramento",
  description: "Consulta o histórico de execuções (ticks) de um monitoramento: quando rodou e se detectou mudança.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: z.object({
    monitoramentoId: z.string().min(1),
    cursor: z.string().nullable(),
  }),
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await consultarAtividadesMonitoramento(args.monitoramentoId, { limit: 50, cursor: args.cursor ?? undefined });
    if (!result.ok) return errorResult(result.error.message);
    return { ok: true, ...normalizeMonitorAtividades(result.data) };
  },
});
