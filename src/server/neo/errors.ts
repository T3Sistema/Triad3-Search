import "server-only";

/**
 * Neutral, pt-BR error surface for the Neo orchestrator. Mirrors the shape
 * of src/server/integrations/web-intelligence/errors.ts so both integrations
 * share the same mental model — but this one strips LLM-provider identifiers
 * instead of scraping-provider ones (see sanitizeNeoError below).
 */
export type NeoErrorType =
  | "configuration"
  | "validation"
  | "authorization"
  | "not_found"
  | "rate_limit"
  | "timeout"
  | "provider_error"
  | "cancelled"
  | "limit_reached"
  | "unknown";

export interface NeoError {
  type: NeoErrorType;
  message: string;
  httpStatus: number;
}

const NEO_PT_BR_MESSAGES: Record<NeoErrorType, string> = {
  configuration: "O Neo ainda não está configurado.",
  validation: "Confira os dados enviados. A requisição possui informações inválidas.",
  authorization: "Sessão inválida ou expirada.",
  not_found: "Recurso não encontrado.",
  rate_limit: "Limite temporário atingido. Tente novamente em alguns instantes.",
  timeout: "Uma fonte demorou mais que o esperado. Tente novamente.",
  provider_error: "Não foi possível iniciar a investigação. Tente novamente em instantes.",
  cancelled: "A execução foi interrompida.",
  limit_reached: "O limite desta investigação foi atingido. O relatório foi concluído parcialmente.",
  unknown: "Ocorreu um erro inesperado ao processar a solicitação.",
};

const STATUS_BY_TYPE: Record<NeoErrorType, number> = {
  configuration: 503,
  validation: 400,
  authorization: 401,
  not_found: 404,
  rate_limit: 429,
  timeout: 504,
  provider_error: 502,
  cancelled: 409,
  limit_reached: 200,
  unknown: 500,
};

export function neoError(type: NeoErrorType, messageOverride?: string): NeoError {
  return {
    type,
    message: messageOverride ?? NEO_PT_BR_MESSAGES[type],
    httpStatus: STATUS_BY_TYPE[type],
  };
}

export class NeoConfigurationError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured");
    this.name = "NeoConfigurationError";
  }
}

/**
 * Strips anything that could identify the underlying LLM provider, SDK,
 * model name, or API surface from a raw message before it reaches the
 * browser. Same philosophy as sanitizeIntegrationError for the scraping
 * integration — known phrases are translated, everything else suspicious is
 * dropped rather than risk a leak.
 */
const VENDOR_PATTERNS = [
  /openai/i,
  /\bgpt-?5(\.\d+)?\b/i,
  /\bgpt\b/i,
  /responses api/i,
  /chat completions/i,
  /\bo\d-(mini|preview)\b/i,
];
const AUTH_TOKEN_PATTERN = /\b(api[-_ ]?key|authorization|bearer|sk-[a-z0-9]+)\b/i;
const DOMAIN_PATTERN = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'<>]*)?/gi;

export function sanitizeNeoError(rawMessage: string | undefined | null): string | undefined {
  if (!rawMessage) return undefined;
  const trimmed = rawMessage.trim();
  if (!trimmed) return undefined;

  const containsVendor = VENDOR_PATTERNS.some((pattern) => pattern.test(trimmed));
  const containsAuthToken = AUTH_TOKEN_PATTERN.test(trimmed);
  if (containsVendor || containsAuthToken) return undefined;

  const withoutDomains = trimmed.replace(DOMAIN_PATTERN, "").replace(/\s{2,}/g, " ").trim();
  if (!withoutDomains) return undefined;
  if (withoutDomains.length > 300) return withoutDomains.slice(0, 300) + "…";
  return withoutDomains;
}

/** Maps an unknown thrown error (SDK error, network failure, etc.) to a NeoError, never leaking details. */
export function normalizeThrownError(err: unknown): NeoError {
  if (err instanceof NeoConfigurationError) return neoError("configuration");

  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const status = typeof record.status === "number" ? record.status : undefined;
    if (status === 401 || status === 403) return neoError("authorization", "A integração não está configurada corretamente.");
    if (status === 404) return neoError("not_found");
    if (status === 429) return neoError("rate_limit");
    if (status === 408 || (err instanceof Error && err.name === "AbortError")) return neoError("timeout");
    if (typeof status === "number" && status >= 500) return neoError("provider_error");
  }

  return neoError("unknown");
}
