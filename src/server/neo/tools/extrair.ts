import "server-only";
import { z } from "zod";
import { registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { extrairDados } from "@/server/services/extrair";
import { normalizeExtrair } from "@/server/neo/tool-normalizers";
import { isHttpUrl } from "@/lib/url";

const extrairParamsSchema = z.object({
  url: z.string().nullable(),
  markdown: z.string().nullable(),
  instrucao: z.string().min(1),
  campos: z.array(z.string()),
});

registerNeoTool({
  name: "extrair_dados",
  nomePublico: "Extraindo informações",
  description:
    "Transforma o conteúdo de uma página (por URL já conhecida, ou markdown já capturado por outra etapa) em dados estruturados, buscando apenas os campos pedidos em `campos`. Use logo após capturar_pagina (ou quando um resultado de pesquisa já tiver o conteúdo necessário) para obter campos específicos como documentos, identificadores, contatos ou nomes — é mais confiável do que tentar localizar o dado manualmente no texto bruto. Informe exatamente uma fonte: `url` OU `markdown` (nunca as duas, nunca nenhuma). Só retorna campos sustentados pelo conteúdo da fonte.",
  persistent: false,
  timeoutMs: 45_000,
  parameters: extrairParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const hasUrl = Boolean(args.url);
    const hasMarkdown = Boolean(args.markdown);
    if (hasUrl === hasMarkdown) {
      return {
        ok: false,
        resumo: null,
        fontes: [],
        parcial: false,
        informacoesAusentes: [],
        erroPublico: "Informe exatamente uma fonte: url ou markdown.",
      };
    }
    if (hasUrl && !isHttpUrl(args.url!)) {
      return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico: "URL inválida ou não pública." };
    }

    const prompt = args.campos.length > 0 ? `${args.instrucao}\n\nCampos solicitados: ${args.campos.join(", ")}` : args.instrucao;

    const result = await extrairDados({
      url: args.url ?? undefined,
      markdown: args.markdown ?? undefined,
      prompt,
    });
    if (!result.ok) {
      return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico: result.error.message };
    }
    const normalized = normalizeExtrair(args.url ?? "conteúdo fornecido", result.data);
    return { ok: true, ...normalized };
  },
});
