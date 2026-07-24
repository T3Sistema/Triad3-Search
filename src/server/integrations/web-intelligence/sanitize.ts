import "server-only";

/**
 * Strips anything that could identify the underlying integration (vendor
 * name, external domain, internal auth header, technical jargon) from a raw
 * message before it is ever allowed into a response body sent to the
 * browser. Known phrases are translated to a safe, neutral pt-BR sentence;
 * anything else is redacted and dropped unless it is unambiguously clean.
 *
 * Only applies to technical/infrastructure messages — never to content the
 * user themselves fetched from a page or search result.
 */

const KNOWN_MESSAGE_TRANSLATIONS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /unauthorized/i, message: "A integração não está configurada corretamente." },
  { pattern: /payment required|insufficient credits|not enough credits/i, message: "Não há créditos suficientes para concluir a operação." },
  { pattern: /rate limit/i, message: "O limite temporário de requisições foi atingido. Tente novamente em instantes." },
  { pattern: /timeout/i, message: "O serviço demorou mais que o esperado para responder." },
  { pattern: /internal server error|service unavailable|bad gateway/i, message: "O serviço não conseguiu concluir a operação." },
  { pattern: /forbidden|access denied/i, message: "O acesso a este recurso não foi autorizado." },
  { pattern: /not found/i, message: "O recurso solicitado não foi encontrado." },
];

const VENDOR_NAME_PATTERNS = [/scrape\s*graph\s*ai/i, /\bsgai\b/i];
const DOMAIN_PATTERN = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'<>]*)?/gi;
const AUTH_TOKEN_PATTERN = /\b(sgai-apikey|authorization|bearer)\b/i;

export function sanitizeIntegrationError(rawMessage: string | undefined | null): string | undefined {
  if (!rawMessage) return undefined;
  const trimmed = rawMessage.trim();
  if (!trimmed) return undefined;

  for (const { pattern, message } of KNOWN_MESSAGE_TRANSLATIONS) {
    if (pattern.test(trimmed)) return message;
  }

  const containsVendorName = VENDOR_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
  const containsAuthToken = AUTH_TOKEN_PATTERN.test(trimmed);
  if (containsVendorName || containsAuthToken) return undefined;

  const withoutDomains = trimmed.replace(DOMAIN_PATTERN, "").replace(/\s{2,}/g, " ").trim();
  if (!withoutDomains) return undefined;
  if (withoutDomains.length > 300) return withoutDomains.slice(0, 300) + "…";
  return withoutDomains;
}
