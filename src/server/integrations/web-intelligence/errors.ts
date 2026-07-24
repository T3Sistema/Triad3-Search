import { sanitizeIntegrationError } from "./sanitize";

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
  configuration: "A integração não está configurada corretamente no servidor.",
  validation: "Confira os campos enviados. A requisição possui dados inválidos.",
  authentication: "A integração não está configurada corretamente.",
  payment_required: "Não há créditos suficientes para concluir a operação.",
  forbidden: "O acesso a este recurso não foi autorizado.",
  not_found: "Recurso não encontrado.",
  rate_limit: "O limite temporário de requisições foi atingido. Tente novamente em instantes.",
  server_error: "O serviço não conseguiu concluir a operação. Tente novamente em instantes.",
  network: "Não foi possível se comunicar com o serviço no momento.",
  timeout: "O serviço demorou mais que o esperado para responder.",
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
  const safeOriginal = sanitizeIntegrationError(originalMessage);
  return {
    type,
    message: messageForType(type),
    details,
    originalMessage: safeOriginal,
    httpStatus,
  };
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
