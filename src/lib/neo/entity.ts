import { z } from "zod";

/**
 * Structured entity memory — the code-level guarantee behind "nunca colapsar
 * CNPJs diferentes porque possuem o mesmo nome, nunca escolher um CNPJ
 * arbitrariamente" (regra permanente). Populated after every completed
 * relatório by walking its "entidade"/"pessoa" blocos (src/server/neo/entity-memory.ts)
 * and merged with the conversation's existing memory using an identifier-only
 * merge key — never merged by label/name alone. Persisted on
 * neo_conversas.entidades_ativas and fed back into the next turn's context
 * (src/server/neo/context-builder.ts) so the model can resolve pronouns
 * ("dela", "a outra empresa") and corrections against a stable id instead of
 * re-deriving the entity from scratch every turn.
 */

export const NEO_ENTIDADE_TIPOS = ["pessoa", "empresa", "dominio", "perfil_social", "endereco", "telefone", "email"] as const;
export type NeoEntidadeTipo = (typeof NEO_ENTIDADE_TIPOS)[number];

export const NEO_VINCULO_CLASSIFICACOES = [
  "vinculo_direto",
  "vinculo_provavel",
  "matriz",
  "filial",
  "empresa_relacionada",
  "homonimo_sem_vinculo",
  "vinculo_historico",
  "descartado_por_inconsistencia",
] as const;
export type NeoVinculoClassificacao = (typeof NEO_VINCULO_CLASSIFICACOES)[number];

export const neoVinculoEntidadeSchema = z.object({
  entidadeId: z.string(),
  classificacao: z.enum(NEO_VINCULO_CLASSIFICACOES),
  evidencia: z.string().nullable(),
});
export type NeoVinculoEntidade = z.infer<typeof neoVinculoEntidadeSchema>;

export const neoEntidadeSchema = z.object({
  /** Stable local id, assigned by code (never by the model) — "e1", "e2", ... scoped to the conversation. */
  id: z.string().min(1),
  tipo: z.enum(NEO_ENTIDADE_TIPOS),
  rotulo: z.string(),
  /**
   * Canonical dedup key when one genuinely exists (CNPJ digits-only, a
   * normalized domain, an e-mail) — merging two entities of the same tipo is
   * only ever allowed when this matches exactly. `null` means "no reliable
   * identifier yet" and the entity is never auto-merged with anything else,
   * even a same-tipo entity with an identical rotulo.
   */
  identificador: z.string().nullable(),
  atributos: z.record(z.string(), z.string()),
  vinculos: z.array(neoVinculoEntidadeSchema),
  fonteUrls: z.array(z.string()),
  atualizadoEm: z.string(),
});
export type NeoEntidade = z.infer<typeof neoEntidadeSchema>;

export const neoEntidadeMemoriaSchema = z.array(neoEntidadeSchema);
export type NeoEntidadeMemoria = z.infer<typeof neoEntidadeMemoriaSchema>;
