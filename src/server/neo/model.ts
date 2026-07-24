import "server-only";

/**
 * The one and only model the Neo orchestrator is allowed to use — for
 * planning, tool-calling, summarization, titles and the final structured
 * report. Never read from an environment variable, request payload, query
 * string or user-configurable setting. If this model is ever unavailable,
 * surface a handled error (see errors.ts) — never fall back to another model.
 */
export const NEO_MODEL = "gpt-5.4-mini" as const;
export type NeoModel = typeof NEO_MODEL;
