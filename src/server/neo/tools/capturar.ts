import "server-only";
import { z } from "zod";
import { registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { capturarPagina } from "@/server/services/capturar";
import { normalizeCapturar } from "@/server/neo/tool-normalizers";
import { isHttpUrl } from "@/lib/url";
import type { ScrapeFormat } from "@/lib/integration/formats";

const NEO_CAPTURAR_FORMATOS = ["markdown", "links", "imagens", "resumo"] as const;
type NeoCapturarFormato = (typeof NEO_CAPTURAR_FORMATOS)[number];

const FORMAT_MAP: Record<NeoCapturarFormato, ScrapeFormat> = {
  markdown: { type: "markdown" },
  links: { type: "links" },
  imagens: { type: "images" },
  resumo: { type: "summary" },
};

const capturarParamsSchema = z.object({
  url: z.string().min(1),
  formatos: z.array(z.enum(NEO_CAPTURAR_FORMATOS)),
});

registerNeoTool({
  name: "capturar_pagina",
  nomePublico: "Lendo página",
  description:
    "Lê o conteúdo de uma URL já conhecida (encontrada por uma pesquisa anterior ou informada pelo usuário). Retorna markdown, links, imagens e/ou um resumo da página. Use para analisar uma fonte específica em detalhe.",
  persistent: false,
  timeoutMs: 45_000,
  parameters: capturarParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    if (!isHttpUrl(args.url)) {
      return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico: "URL inválida ou não pública." };
    }
    const formatos = args.formatos.length > 0 ? args.formatos : (["markdown"] as const);
    const formats = Array.from(new Set(formatos)).map((f) => FORMAT_MAP[f]);

    const result = await capturarPagina({ url: args.url, formats });
    if (!result.ok) {
      return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico: result.error.message };
    }
    const normalized = normalizeCapturar(args.url, result.data);
    return { ok: true, ...normalized };
  },
});
