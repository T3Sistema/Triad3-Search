export type ErrorType =
  | "configuration"
  | "validation"
  | "authentication"
  | "payment_required"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "server_error"
  | "network"
  | "timeout"
  | "unknown";

export interface NormalizedError {
  type: ErrorType;
  message: string;
  details?: unknown;
  originalMessage?: string;
  httpStatus: number;
}

const PT_BR_MESSAGES: Record<ErrorType, string> = {
  configuration: "A chave SGAI_API_KEY não está configurada no servidor.",
  validation: "Confira os campos enviados. A requisição possui dados inválidos.",
  authentication: "Chave da API ausente ou não enviada corretamente.",
  payment_required: "Créditos insuficientes para concluir esta operação.",
  forbidden: "Chave inválida, sem acesso a este recurso, ou endpoint descontinuado.",
  not_found: "Recurso não encontrado.",
  rate_limit: "Limite de requisições atingido. Aguarde antes de tentar novamente.",
  server_error: "Erro temporário no serviço da ScrapeGraphAI. Tente novamente em instantes.",
  network: "Não foi possível se comunicar com a ScrapeGraphAI.",
  timeout: "O tempo limite da requisição foi atingido.",
  unknown: "Ocorreu um erro inesperado ao processar a requisição.",
};

export function errorTypeForStatus(status: number): ErrorType {
  switch (status) {
    case 400:
      return "validation";
    case 401:
      return "authentication";
    case 402:
      return "payment_required";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 429:
      return "rate_limit";
    default:
      return status >= 500 ? "server_error" : "unknown";
  }
}

export function messageForType(type: ErrorType): string {
  return PT_BR_MESSAGES[type];
}

/**
 * Builds the standardized error envelope. `originalMessage` is only kept when it
 * looks safe (short, no obvious secrets) so we can show it as extra context.
 */
export function normalizeError(
  httpStatus: number,
  originalMessage?: string,
  details?: unknown,
  typeOverride?: ErrorType,
): NormalizedError {
  const type = typeOverride ?? errorTypeForStatus(httpStatus);
  const safeOriginal = sanitizeOriginalMessage(originalMessage);
  return {
    type,
    message: messageForType(type),
    details,
    originalMessage: safeOriginal,
    httpStatus,
  };
}

function sanitizeOriginalMessage(message?: string): string | undefined {
  if (!message) return undefined;
  const trimmed = message.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 500) return trimmed.slice(0, 500) + "…";
  const looksSensitive = /sgai-|api[_-]?key|authorization|bearer\s/i.test(trimmed);
  return looksSensitive ? undefined : trimmed;
}

export function toErrorResponseBody(error: NormalizedError) {
  return {
    error: {
      type: error.type,
      message: error.message,
      ...(error.originalMessage ? { originalMessage: error.originalMessage } : {}),
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };
}
