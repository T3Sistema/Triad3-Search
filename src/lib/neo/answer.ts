import { z } from "zod";

/**
 * NeoAnswer — the versioned, structured shape of every Neo analysis
 * report. Shared between server (Structured Outputs schema + post-validation
 * in src/server/neo/synthesizer.ts) and client (rendering in
 * src/components/neo/). No secrets, no vendor names, no branding — safe for
 * the browser bundle, same rule as src/lib/integration/schemas.ts.
 *
 * Every field the model must fill is required; anything that can be absent
 * uses `.nullable()` (never `.optional()`) so the JSON Schema stays strict
 * — see node_modules/openai/helpers/zod.js `toStrictJsonSchema`.
 *
 * Version 2 restructures the report around consolidated findings (a direct
 * answer + numbered achados + an evidence traceability matrix) instead of a
 * freeform block list that let the model default to dumping links. Version 1
 * is kept below, read-only, purely so `normalizeNeoAnswer` can upgrade
 * conversations stored before this change — old messages must keep opening
 * correctly (see src/server/neo/reconciliation.ts and every export route).
 */

export const NEO_ANSWER_VERSION = 2 as const;

export const NEO_ANSWER_STATUS = ["completo", "parcial", "precisa_de_informacao", "nao_concluido"] as const;
export type NeoAnswerStatus = (typeof NEO_ANSWER_STATUS)[number];

export const NEO_NIVEL_EVIDENCIA = [
  "confirmado",
  "bem_sustentado",
  "indicio",
  "nao_localizado",
  "divergente",
] as const;
export type NeoNivelEvidencia = (typeof NEO_NIVEL_EVIDENCIA)[number];

export const NEO_ALERTA_CATEGORIAS = [
  "informacao_ausente",
  "divergencia",
  "resultado_parcial",
  "limitacao",
  "cuidado_interpretativo",
] as const;
export type NeoAlertaCategoria = (typeof NEO_ALERTA_CATEGORIAS)[number];

export const NEO_LACUNA_TIPOS = [
  "nao_encontrado",
  "nao_confirmado",
  "contraditorio",
  "pode_ter_mudado",
  "consulta_complementar",
] as const;
export type NeoLacunaTipo = (typeof NEO_LACUNA_TIPOS)[number];

export const NEO_PAPEL_PESSOA = [
  "responsavel_legal",
  "administrador",
  "socio",
  "fundador",
  "proprietario",
  "representante_publico",
  "relacionado",
] as const;
export type NeoPapelPessoa = (typeof NEO_PAPEL_PESSOA)[number];

// ---------------------------------------------------------------------------
// Fontes (shared by v1 and v2)
// ---------------------------------------------------------------------------
export const neoFonteSchema = z.object({
  id: z.string().min(1),
  titulo: z.string().nullable(),
  url: z.string().min(1),
  dominio: z.string().nullable(),
  dataAcesso: z.string().nullable(),
});
export type NeoFonte = z.infer<typeof neoFonteSchema>;

const rotuloValorSchema = z.object({ rotulo: z.string(), valor: z.string() });
const rotuloUrlSchema = z.object({ rotulo: z.string(), url: z.string() });

export const neoFatoSchema = z.object({
  rotulo: z.string(),
  valor: z.string(),
  tipo: z.string().nullable(),
  nivelEvidencia: z.enum(NEO_NIVEL_EVIDENCIA),
  dataObservacao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export type NeoFato = z.infer<typeof neoFatoSchema>;

// ---------------------------------------------------------------------------
// Blocos compartilhados entre v1 e v2 (formato inalterado)
// ---------------------------------------------------------------------------
export const neoBlocoTextoSchema = z.object({
  tipo: z.literal("texto"),
  titulo: z.string().nullable(),
  conteudo: z.string(),
  fontesIds: z.array(z.string()),
});

export const neoBlocoFatosSchema = z.object({
  tipo: z.literal("fatos"),
  titulo: z.string().nullable(),
  itens: z.array(neoFatoSchema),
});

export const neoMetricaSchema = z.object({
  rotulo: z.string(),
  valor: z.string(),
  unidade: z.string().nullable(),
  comparacao: z.string().nullable(),
  dataObservacao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export type NeoMetrica = z.infer<typeof neoMetricaSchema>;

export const neoBlocoMetricasSchema = z.object({
  tipo: z.literal("metricas"),
  titulo: z.string().nullable(),
  itens: z.array(neoMetricaSchema),
});

export const neoBlocoImagemSchema = z.object({
  tipo: z.literal("imagem"),
  url: z.string(),
  legenda: z.string().nullable(),
  textoAlternativo: z.string(),
  fontesIds: z.array(z.string()),
});

export const neoBlocoTabelaSchema = z.object({
  tipo: z.literal("tabela"),
  titulo: z.string().nullable(),
  colunas: z.array(z.string()),
  linhas: z.array(z.array(z.string())),
  fontesIds: z.array(z.string()),
  exportavelCsv: z.boolean(),
});

export const neoEventoTimelineSchema = z.object({
  data: z.string().nullable(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export const neoBlocoTimelineSchema = z.object({
  tipo: z.literal("timeline"),
  titulo: z.string().nullable(),
  itens: z.array(neoEventoTimelineSchema),
});

export const neoRelacaoSchema = z.object({
  origem: z.string(),
  relacao: z.string(),
  destino: z.string(),
  evidencia: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export const neoBlocoRelacoesSchema = z.object({
  tipo: z.literal("relacoes"),
  titulo: z.string().nullable(),
  itens: z.array(neoRelacaoSchema),
});

export const neoBlocoAlertaSchema = z.object({
  tipo: z.literal("alerta"),
  categoria: z.enum(NEO_ALERTA_CATEGORIAS),
  mensagem: z.string(),
});

export const neoBlocoFontesSchema = z.object({
  tipo: z.literal("fontes"),
  itens: z.array(neoFonteSchema),
});

// ---------------------------------------------------------------------------
// Version 1 (legado — somente leitura, usado pelo normalizador)
// ---------------------------------------------------------------------------
export const NEO_ANSWER_VERSION_1 = 1 as const;

const rotuloValorArraySchema = z.array(rotuloValorSchema);

export const neoBlocoEntidadeV1Schema = z.object({
  tipo: z.literal("entidade"),
  nome: z.string(),
  subtitulo: z.string().nullable(),
  descricao: z.string().nullable(),
  imagemUrl: z.string().nullable(),
  identificadores: rotuloValorArraySchema,
  links: z.array(rotuloUrlSchema),
  metricas: rotuloValorArraySchema,
  atributos: rotuloValorArraySchema,
  fontesIds: z.array(z.string()),
});

const neoBlocoV1Schema = z.discriminatedUnion("tipo", [
  neoBlocoTextoSchema,
  neoBlocoFatosSchema,
  neoBlocoEntidadeV1Schema,
  neoBlocoMetricasSchema,
  neoBlocoImagemSchema,
  neoBlocoTabelaSchema,
  neoBlocoTimelineSchema,
  neoBlocoRelacoesSchema,
  neoBlocoAlertaSchema,
  neoBlocoFontesSchema,
]);
type NeoBlocoV1 = z.infer<typeof neoBlocoV1Schema>;

export const neoAnswerV1Schema = z.object({
  version: z.literal(NEO_ANSWER_VERSION_1),
  status: z.enum(NEO_ANSWER_STATUS),
  titulo: z.string(),
  resumoExecutivo: z.string(),
  blocos: z.array(neoBlocoV1Schema),
  fontes: z.array(neoFonteSchema),
  informacoesAusentes: z.array(z.string()),
  observacoes: z.array(z.string()),
  proximasAcoes: z.array(z.string()),
  perguntaNecessaria: z.string().nullable(),
});
export type NeoAnswerV1 = z.infer<typeof neoAnswerV1Schema>;

// ---------------------------------------------------------------------------
// Version 2 — blocos novos/atualizados
// ---------------------------------------------------------------------------
export const neoBlocoEntidadeSchema = z.object({
  tipo: z.literal("entidade"),
  nome: z.string(),
  subtitulo: z.string().nullable(),
  descricao: z.string().nullable(),
  imagemUrl: z.string().nullable(),
  identificadores: rotuloValorArraySchema,
  links: z.array(rotuloUrlSchema),
  metricas: rotuloValorArraySchema,
  atributos: z.array(neoFatoSchema),
  fontesIds: z.array(z.string()),
});

export const neoPapelPessoaItemSchema = z.object({
  classificacao: z.enum(NEO_PAPEL_PESSOA),
  nivelEvidencia: z.enum(NEO_NIVEL_EVIDENCIA),
  evidencia: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export type NeoPapelPessoaItem = z.infer<typeof neoPapelPessoaItemSchema>;

export const neoOrganizacaoRelacionadaSchema = z.object({
  nome: z.string(),
  relacao: z.string(),
  fontesIds: z.array(z.string()),
});

/** Pessoa relacionada à análise — nunca rotulada "dona" automaticamente; cada papel carrega seu próprio nível de evidência. */
export const neoBlocoPessoaSchema = z.object({
  tipo: z.literal("pessoa"),
  nome: z.string(),
  fotoUrl: z.string().nullable(),
  papeis: z.array(neoPapelPessoaItemSchema),
  organizacoesRelacionadas: z.array(neoOrganizacaoRelacionadaSchema),
  atributos: z.array(neoFatoSchema),
  fontesIds: z.array(z.string()),
});

/** Genérico para qualquer rede social encontrada — nunca amarrado a uma plataforma específica no código. */
export const neoBlocoPerfilSocialSchema = z.object({
  tipo: z.literal("perfil_social"),
  nome: z.string(),
  arroba: z.string().nullable(),
  bio: z.string().nullable(),
  url: z.string().nullable(),
  fotoUrl: z.string().nullable(),
  seguidores: z.string().nullable(),
  seguindo: z.string().nullable(),
  publicacoes: z.string().nullable(),
  relacao: z.string().nullable(),
  metricaVariavel: z.boolean(),
  dataObservacao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});

export const neoBlocoPublicacaoSchema = z.object({
  tipo: z.literal("publicacao"),
  midiaUrl: z.string().nullable(),
  legenda: z.string().nullable(),
  dataPublicacao: z.string().nullable(),
  curtidas: z.string().nullable(),
  comentarios: z.string().nullable(),
  outrasMetricas: rotuloValorArraySchema,
  contexto: z.string().nullable(),
  url: z.string().nullable(),
  fontesIds: z.array(z.string()),
});

export const neoBlocoSchema = z.discriminatedUnion("tipo", [
  neoBlocoTextoSchema,
  neoBlocoFatosSchema,
  neoBlocoEntidadeSchema,
  neoBlocoPessoaSchema,
  neoBlocoPerfilSocialSchema,
  neoBlocoPublicacaoSchema,
  neoBlocoMetricasSchema,
  neoBlocoImagemSchema,
  neoBlocoTabelaSchema,
  neoBlocoTimelineSchema,
  neoBlocoRelacoesSchema,
  neoBlocoAlertaSchema,
]);
export type NeoBloco = z.infer<typeof neoBlocoSchema>;
export type NeoBlocoTipo = NeoBloco["tipo"];

export const neoIndicadorSchema = z.object({
  rotulo: z.string(),
  valor: z.string(),
  descricao: z.string().nullable(),
  fontesIds: z.array(z.string()),
});
export type NeoIndicador = z.infer<typeof neoIndicadorSchema>;

/** Um achado numerado de "Principais descobertas": conclusão + explicação + evidência, nunca só um link. */
export const neoAchadoSchema = z.object({
  conclusao: z.string(),
  explicacao: z.string(),
  nivelEvidencia: z.enum(NEO_NIVEL_EVIDENCIA),
  fontesIds: z.array(z.string()),
});
export type NeoAchado = z.infer<typeof neoAchadoSchema>;

export const neoLacunaSchema = z.object({
  tipo: z.enum(NEO_LACUNA_TIPOS),
  descricao: z.string(),
});
export type NeoLacuna = z.infer<typeof neoLacunaSchema>;

/** Uma linha de "Como cada conclusão foi sustentada" — reaproveita o vocabulário de nível de evidência com os rótulos exigidos para essa seção (ver src/lib/ui/status-labels.ts). */
export const neoEvidenciaMatrizItemSchema = z.object({
  conclusao: z.string(),
  evidencia: z.string(),
  classificacao: z.enum(NEO_NIVEL_EVIDENCIA),
});
export type NeoEvidenciaMatrizItem = z.infer<typeof neoEvidenciaMatrizItemSchema>;

// ---------------------------------------------------------------------------
// NeoAnswer (v2)
// ---------------------------------------------------------------------------
export const neoAnswerSchema = z.object({
  version: z.literal(NEO_ANSWER_VERSION),
  status: z.enum(NEO_ANSWER_STATUS),
  titulo: z.string(),
  objetivo: z.string(),
  indicadoresPrincipais: z.array(neoIndicadorSchema),
  achados: z.array(neoAchadoSchema),
  respostaDireta: z.string(),
  blocos: z.array(neoBlocoSchema),
  lacunas: z.array(neoLacunaSchema),
  matrizEvidencias: z.array(neoEvidenciaMatrizItemSchema),
  fontes: z.array(neoFonteSchema),
  observacoes: z.array(z.string()),
  proximasAcoes: z.array(z.string()),
  perguntaNecessaria: z.string().nullable(),
});
export type NeoAnswer = z.infer<typeof neoAnswerSchema>;

/**
 * Safe, static fallback used only when there is truly nothing concrete to
 * show — Structured Output validation failed twice in a row with no usable
 * evidence, or the stored data couldn't be parsed at all. Always
 * "nao_concluido": never fabricates cards, achados or a matrix from nothing.
 */
export function buildFallbackAnswer(texto: string): NeoAnswer {
  return {
    version: NEO_ANSWER_VERSION,
    status: "nao_concluido",
    titulo: "Não foi possível confirmar os dados solicitados",
    objetivo: "",
    indicadoresPrincipais: [],
    achados: [],
    respostaDireta: texto,
    blocos: [],
    lacunas: [],
    matrizEvidencias: [],
    fontes: [],
    observacoes: [],
    proximasAcoes: [],
    perguntaNecessaria: null,
  };
}

function upgradeV1ToV2(v1: NeoAnswerV1): NeoAnswer {
  const blocos: NeoBloco[] = [];
  const inlineFontes: NeoFonte[] = [];

  for (const bloco of v1.blocos as NeoBlocoV1[]) {
    if (bloco.tipo === "fontes") {
      inlineFontes.push(...bloco.itens);
      continue;
    }
    if (bloco.tipo === "entidade") {
      blocos.push({
        ...bloco,
        atributos: bloco.atributos.map((a) => ({
          rotulo: a.rotulo,
          valor: a.valor,
          tipo: null,
          nivelEvidencia: "bem_sustentado",
          dataObservacao: null,
          fontesIds: [],
        })),
      });
      continue;
    }
    blocos.push(bloco);
  }

  const fontes = [...v1.fontes];
  const seen = new Set(fontes.map((f) => f.url));
  let nextId = fontes.length + 1;
  for (const fonte of inlineFontes) {
    if (seen.has(fonte.url)) continue;
    seen.add(fonte.url);
    fontes.push({ ...fonte, id: `f${nextId++}` });
  }

  return {
    version: NEO_ANSWER_VERSION,
    status: v1.status,
    titulo: v1.titulo,
    objetivo: "",
    indicadoresPrincipais: [],
    achados: [],
    respostaDireta: v1.resumoExecutivo,
    blocos,
    lacunas: v1.informacoesAusentes.map((descricao) => ({ tipo: "nao_encontrado" as const, descricao })),
    matrizEvidencias: [],
    fontes,
    observacoes: v1.observacoes,
    proximasAcoes: v1.proximasAcoes,
    perguntaNecessaria: v1.perguntaNecessaria,
  };
}

/**
 * Single entry point every renderer/exporter should call instead of parsing
 * `respostaEstruturada` directly. Accepts a v2 answer as-is, upgrades a v1
 * answer (any conversation from before this change), and falls back to a
 * safe minimal report for anything else unparseable — never raw JSON, never
 * a thrown error.
 */
export function normalizeNeoAnswer(raw: unknown): NeoAnswer {
  const v2 = neoAnswerSchema.safeParse(raw);
  if (v2.success) return v2.data;

  const v1 = neoAnswerV1Schema.safeParse(raw);
  if (v1.success) return upgradeV1ToV2(v1.data);

  return buildFallbackAnswer("Não foi possível carregar este relatório no formato esperado.");
}

// ---------------------------------------------------------------------------
// Fontes utilizadas — nunca confundir "resultado encontrado" com "fonte que
// sustenta uma conclusão". Um resultado de busca só vira fonte utilizada
// quando alguma conclusão realmente o cita via fontesIds.
// ---------------------------------------------------------------------------
function collectCitedFonteIds(answer: Pick<NeoAnswer, "indicadoresPrincipais" | "achados" | "blocos">): Set<string> {
  const ids = new Set<string>();
  const add = (fontesIds: string[]) => fontesIds.forEach((id) => ids.add(id));

  answer.indicadoresPrincipais.forEach((i) => add(i.fontesIds));
  answer.achados.forEach((a) => add(a.fontesIds));

  for (const bloco of answer.blocos) {
    switch (bloco.tipo) {
      case "texto":
      case "imagem":
      case "tabela":
      case "perfil_social":
      case "publicacao":
        add(bloco.fontesIds);
        break;
      case "fatos":
        bloco.itens.forEach((f) => add(f.fontesIds));
        break;
      case "entidade":
        add(bloco.fontesIds);
        bloco.atributos.forEach((a) => add(a.fontesIds));
        break;
      case "pessoa":
        add(bloco.fontesIds);
        bloco.atributos.forEach((a) => add(a.fontesIds));
        bloco.papeis.forEach((p) => add(p.fontesIds));
        bloco.organizacoesRelacionadas.forEach((o) => add(o.fontesIds));
        break;
      case "metricas":
        bloco.itens.forEach((m) => add(m.fontesIds));
        break;
      case "timeline":
        bloco.itens.forEach((e) => add(e.fontesIds));
        break;
      case "relacoes":
        bloco.itens.forEach((r) => add(r.fontesIds));
        break;
      case "alerta":
        break;
      default:
        break;
    }
  }
  return ids;
}

function remapBlocoFontes(bloco: NeoBloco, remap: (ids: string[]) => string[]): NeoBloco {
  switch (bloco.tipo) {
    case "texto":
    case "imagem":
    case "tabela":
    case "perfil_social":
    case "publicacao":
      return { ...bloco, fontesIds: remap(bloco.fontesIds) };
    case "fatos":
      return { ...bloco, itens: bloco.itens.map((f) => ({ ...f, fontesIds: remap(f.fontesIds) })) };
    case "entidade":
      return {
        ...bloco,
        fontesIds: remap(bloco.fontesIds),
        atributos: bloco.atributos.map((a) => ({ ...a, fontesIds: remap(a.fontesIds) })),
      };
    case "pessoa":
      return {
        ...bloco,
        fontesIds: remap(bloco.fontesIds),
        atributos: bloco.atributos.map((a) => ({ ...a, fontesIds: remap(a.fontesIds) })),
        papeis: bloco.papeis.map((p) => ({ ...p, fontesIds: remap(p.fontesIds) })),
        organizacoesRelacionadas: bloco.organizacoesRelacionadas.map((o) => ({ ...o, fontesIds: remap(o.fontesIds) })),
      };
    case "metricas":
      return { ...bloco, itens: bloco.itens.map((m) => ({ ...m, fontesIds: remap(m.fontesIds) })) };
    case "timeline":
      return { ...bloco, itens: bloco.itens.map((e) => ({ ...e, fontesIds: remap(e.fontesIds) })) };
    case "relacoes":
      return { ...bloco, itens: bloco.itens.map((r) => ({ ...r, fontesIds: remap(r.fontesIds) })) };
    case "alerta":
      return bloco;
    default:
      return bloco;
  }
}

/**
 * Recomputes `fontes` to contain only sources genuinely cited somewhere in
 * the report (indicadores/achados/blocos) — a search returning 13 results
 * must never be reported as "13 fontes utilizadas". Re-numbers ids
 * sequentially and rewrites every fontesIds reference so citations never
 * break. A no-op (returns the same object) when nothing needs pruning.
 */
export function pruneUnusedFontes(answer: NeoAnswer): NeoAnswer {
  const citedIds = collectCitedFonteIds(answer);
  const kept = answer.fontes.filter((f) => citedIds.has(f.id));
  if (kept.length === answer.fontes.length) return answer;

  const idMap = new Map<string, string>();
  const renumbered = kept.map((f, i) => {
    const novoId = `f${i + 1}`;
    idMap.set(f.id, novoId);
    return { ...f, id: novoId };
  });
  const remap = (ids: string[]) => ids.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id));

  return {
    ...answer,
    fontes: renumbered,
    indicadoresPrincipais: answer.indicadoresPrincipais.map((i) => ({ ...i, fontesIds: remap(i.fontesIds) })),
    achados: answer.achados.map((a) => ({ ...a, fontesIds: remap(a.fontesIds) })),
    blocos: answer.blocos.map((bloco) => remapBlocoFontes(bloco, remap)),
  };
}
