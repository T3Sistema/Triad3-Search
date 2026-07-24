import "server-only";
import { z } from "zod";
import { registerNeoTool, type NeoToolExecutionResult } from "@/server/neo/tool-registry";
import { pesquisarWeb } from "@/server/services/pesquisar";
import { normalizePesquisar } from "@/server/neo/tool-normalizers";
import { SEARCH_TIME_RANGES } from "@/lib/integration/schemas";

const pesquisarParamsSchema = z.object({
  consulta: z.string().min(1),
  numeroResultados: z.number().int().min(1).max(20).nullable(),
  intervaloTempo: z.enum(SEARCH_TIME_RANGES).nullable(),
});

registerNeoTool({
  name: "pesquisar_web",
  nomePublico: "Pesquisando fontes",
  description:
    "Pesquisa na web por páginas, entidades, documentos, perfis e fontes relacionadas ao objetivo da investigação. Prefira consultas curtas e específicas, combinando um identificador já conhecido do alvo (domínio, nome, razão social) com o campo procurado (ex.: 'dominio.com.br CNPJ'). Nunca repita uma consulta equivalente a uma já feita apenas com palavras reorganizadas — só pesquise de novo sobre o mesmo campo se um identificador novo foi descoberto.",
  persistent: false,
  timeoutMs: 45_000,
  parameters: pesquisarParamsSchema,
  async execute(args): Promise<NeoToolExecutionResult> {
    const result = await pesquisarWeb({
      query: args.consulta,
      numResults: args.numeroResultados ?? undefined,
      timeRange: args.intervaloTempo ?? undefined,
    });
    if (!result.ok) {
      return { ok: false, resumo: null, fontes: [], parcial: false, informacoesAusentes: [], erroPublico: result.error.message };
    }
    const normalized = normalizePesquisar(args.consulta, result.data);
    return { ok: true, ...normalized };
  },
});
