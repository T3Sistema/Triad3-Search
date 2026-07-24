import "server-only";

/**
 * Canonical, stable tool names exposed to the model. Never shown to the
 * user — the frontend only ever sees `nomePublico` (see tool-registry.ts).
 * Kept in its own module (no dependents besides tool-registry.ts and
 * schemas.ts) to avoid a circular import between the two.
 */
export const NEO_TOOL_NAMES = [
  "pesquisar_web",
  "capturar_pagina",
  "extrair_dados",
  "mapear_iniciar",
  "mapear_status",
  "mapear_paginas",
  "mapear_interromper",
  "mapear_retomar",
  "monitor_criar",
  "monitor_listar",
  "monitor_status",
  "monitor_atualizar",
  "monitor_pausar",
  "monitor_retomar",
  "monitor_excluir",
  "monitor_atividades",
  "consultar_historico",
  "consultar_creditos",
] as const;

export type NeoToolName = (typeof NEO_TOOL_NAMES)[number];

/** Tools with a persistent, real-world effect — must always go through the confirmation flow. */
export const NEO_PERSISTENT_TOOLS: readonly NeoToolName[] = [
  "monitor_criar",
  "monitor_atualizar",
  "monitor_pausar",
  "monitor_retomar",
  "monitor_excluir",
];

export function isPersistentTool(name: string): name is NeoToolName {
  return (NEO_PERSISTENT_TOOLS as readonly string[]).includes(name);
}

export function isKnownTool(name: string): name is NeoToolName {
  return (NEO_TOOL_NAMES as readonly string[]).includes(name);
}
