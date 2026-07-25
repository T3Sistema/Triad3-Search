import { z } from "zod";

/**
 * NeoClarificationForm — an inline structured form the agent can generate
 * instead of asking a free-text question, when it needs a small set of
 * indispensable structured values (a URL to monitor, a frequency, a choice
 * between homonymous entities) that are error-prone to extract from free
 * text. Shared between server (schema validation of the model's Structured
 * Output) and client (rendering in src/components/neo/clarification-form.tsx)
 * — no secrets, no vendor names, safe for the browser bundle.
 */

export const NEO_CAMPO_FORMULARIO_TIPOS = [
  "texto",
  "url",
  "numero",
  "data",
  "selecao",
  "multipla_selecao",
  "alternancia",
  "area_texto",
] as const;
export type NeoCampoFormularioTipo = (typeof NEO_CAMPO_FORMULARIO_TIPOS)[number];

export const neoCampoFormularioOpcaoSchema = z.object({
  valor: z.string(),
  rotulo: z.string(),
});

export const neoCampoFormularioSchema = z.object({
  id: z.string().min(1),
  rotulo: z.string(),
  descricao: z.string().nullable(),
  tipo: z.enum(NEO_CAMPO_FORMULARIO_TIPOS),
  obrigatorio: z.boolean(),
  valorSugerido: z.string().nullable(),
  /** Only meaningful for "selecao"/"multipla_selecao" — empty array otherwise. */
  opcoes: z.array(neoCampoFormularioOpcaoSchema),
});
export type NeoCampoFormulario = z.infer<typeof neoCampoFormularioSchema>;

export const neoClarificationFormSchema = z.object({
  titulo: z.string(),
  explicacao: z.string(),
  campos: z.array(neoCampoFormularioSchema).min(1),
  /** Label for the submit button, e.g. "Confirmar" or "Iniciar monitoramento". */
  acaoConfirmacao: z.string(),
});
export type NeoClarificationForm = z.infer<typeof neoClarificationFormSchema>;

/** Client-side values keyed by campo id — sent back verbatim, revalidated server-side before resuming the agent. */
export type NeoFormularioValores = Record<string, string | string[] | boolean>;
