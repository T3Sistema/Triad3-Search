/**
 * Presentation layer for status/enum values returned by the backend. Raw
 * values are preserved wherever they're used programmatically (badge color,
 * filters, API payloads) — only the rendered label goes through this map.
 */
export const STATUS_LABELS: Record<string, string> = {
  running: "Em execução",
  completed: "Concluído",
  failed: "Falhou",
  stopped: "Interrompido",
  active: "Ativo",
  paused: "Pausado",
  pending: "Pendente",
  connected: "Conectado",
  disconnected: "Desconectado",
  deleted: "Excluído",
  cancelled: "Cancelado",
  canceled: "Cancelado",
  ok: "Concluído",
  error: "Erro",
};

export function translateStatus(status?: string | null): string {
  if (!status) return "—";
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

export type BadgeTone = "success" | "warning" | "error" | "neutral";

const STATUS_TONES: Record<string, BadgeTone> = {
  running: "warning",
  completed: "success",
  ok: "success",
  active: "success",
  connected: "success",
  failed: "error",
  error: "error",
  disconnected: "error",
  stopped: "neutral",
  paused: "warning",
  pending: "neutral",
  deleted: "error",
  cancelled: "neutral",
  canceled: "neutral",
};

export function toneForStatus(status?: string | null): BadgeTone {
  if (!status) return "neutral";
  return STATUS_TONES[status.toLowerCase()] ?? "neutral";
}

export const SERVICE_LABELS: Record<string, string> = {
  scrape: "Captura",
  extract: "Extração",
  search: "Pesquisa",
  monitor: "Monitoramento",
  crawl: "Mapeamento",
  schema: "Schema",
};

export function translateService(service?: string | null): string {
  if (!service) return "—";
  return SERVICE_LABELS[service.toLowerCase()] ?? service;
}
