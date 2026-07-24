import "server-only";
import { z } from "zod";
import { registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import {
  consultarMapeamento,
  iniciarMapeamento,
  interromperMapeamento,
  listarPaginasMapeamento,
  retomarMapeamento,
} from "@/server/services/mapear";
import { normalizeMapearPaginas, normalizeMapearStatus } from "@/server/neo/tool-normalizers";
import { isHttpUrl } from "@/lib/url";

function errorResult(erroPublico: string): NeoToolExecutionResult {
  return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico };
}

const iniciarParamsSchema = z.object({
  url: z.string().min(1),
  maxPaginas: z.number().int().min(1).max(1000).nullable(),
  maxProfundidade: z.number().int().min(0).max(50).nullable(),
});

registerNeoTool({
  name: "mapear_iniciar",
  nomePublico: "Mapeando site",
  description:
    "Inicia o rastreamento de várias páginas de um domínio para reunir conteúdo distribuído em várias URLs. Use quando a informação necessária não está concentrada em uma única página. Retorna um identificador de mapeamento para consultar o progresso depois com mapear_status/mapear_paginas.",
  persistent: false,
  timeoutMs: 55_000,
  parameters: iniciarParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    if (!isHttpUrl(args.url)) return errorResult("URL inválida ou não pública.");
    const result = await iniciarMapeamento({
      url: args.url,
      formats: [{ type: "markdown" }],
      maxPages: args.maxPaginas ?? 30,
      maxDepth: args.maxProfundidade ?? 2,
      maxLinksPerPage: 10,
      allowExternal: false,
    });
    if (!result.ok) return errorResult(result.error.message);
    const normalized = normalizeMapearStatus(result.data);
    return { ok: true, ...normalized };
  },
});

const idParamsSchema = z.object({ mapeamentoId: z.string().min(1) });

registerNeoTool({
  name: "mapear_status",
  nomePublico: "Verificando mapeamento",
  description: "Consulta o status atual de um mapeamento já iniciado (mapear_iniciar): progresso, total de páginas e páginas já concluídas.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: idParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await consultarMapeamento(args.mapeamentoId);
    if (!result.ok) return errorResult(result.error.message);
    const normalized = normalizeMapearStatus(result.data);
    return { ok: true, ...normalized };
  },
});

const paginasParamsSchema = z.object({
  mapeamentoId: z.string().min(1),
  cursor: z.string().nullable(),
});

registerNeoTool({
  name: "mapear_paginas",
  nomePublico: "Listando páginas mapeadas",
  description: "Lista as páginas já coletadas por um mapeamento em andamento ou concluído, com paginação por cursor.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: paginasParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await listarPaginasMapeamento(args.mapeamentoId, { limit: 50, cursor: args.cursor ?? undefined });
    if (!result.ok) return errorResult(result.error.message);
    const normalized = normalizeMapearPaginas(result.data);
    return { ok: true, ...normalized };
  },
});

registerNeoTool({
  name: "mapear_interromper",
  nomePublico: "Interrompendo mapeamento",
  description: "Interrompe um mapeamento em andamento antes de concluir. Use quando já houver informação suficiente ou o mapeamento não for mais necessário.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: idParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await interromperMapeamento(args.mapeamentoId);
    if (!result.ok) return errorResult(result.error.message);
    const normalized = normalizeMapearStatus(result.data);
    return { ok: true, ...normalized };
  },
});

registerNeoTool({
  name: "mapear_retomar",
  nomePublico: "Retomando mapeamento",
  description: "Retoma um mapeamento previamente interrompido.",
  persistent: false,
  timeoutMs: 20_000,
  parameters: idParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await retomarMapeamento(args.mapeamentoId);
    if (!result.ok) return errorResult(result.error.message);
    const normalized = normalizeMapearStatus(result.data);
    return { ok: true, ...normalized };
  },
});
