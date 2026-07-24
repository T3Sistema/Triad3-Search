import "server-only";
import { sgaiRequest, type SgaiResult } from "@/server/integrations/web-intelligence/client";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { MonitorCreateRequest, MonitorPatchRequest } from "@/lib/integration/schemas";
import type {
  MonitorActivityResponse,
  MonitorListResponse,
  MonitorResponse,
} from "@/server/integrations/web-intelligence/types";

/** Shared service behind the manual "Monitorar" module and the corresponding Neo tools. */
export async function criarMonitoramento(input: MonitorCreateRequest): Promise<SgaiResult<MonitorResponse>> {
  const { name, url, interval, formats, webhookUrl, fetchConfig } = input;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = {
    name,
    url,
    interval,
    formats,
    ...(webhookUrl ? { webhookUrl } : {}),
    ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
  };

  return sgaiRequest<MonitorResponse>("POST", "/monitor", { body: payload });
}

export async function listarMonitoramentos(query: {
  page: number;
  limit: number;
  status?: string;
}): Promise<SgaiResult<MonitorListResponse>> {
  return sgaiRequest<MonitorListResponse>("GET", "/monitor", {
    searchParams: { page: query.page, limit: query.limit, status: query.status },
  });
}

export async function consultarMonitoramento(id: string): Promise<SgaiResult<MonitorResponse>> {
  return sgaiRequest<MonitorResponse>("GET", `/monitor/${encodeURIComponent(id)}`);
}

export async function atualizarMonitoramento(
  id: string,
  patch: MonitorPatchRequest,
): Promise<SgaiResult<MonitorResponse>> {
  const { fetchConfig, ...rest } = patch;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = { ...rest, ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}) };
  return sgaiRequest<MonitorResponse>("PATCH", `/monitor/${encodeURIComponent(id)}`, { body: payload });
}

export async function excluirMonitoramento(id: string): Promise<SgaiResult<unknown>> {
  return sgaiRequest("DELETE", `/monitor/${encodeURIComponent(id)}`);
}

export async function pausarMonitoramento(id: string): Promise<SgaiResult<MonitorResponse>> {
  return sgaiRequest<MonitorResponse>("POST", `/monitor/${encodeURIComponent(id)}/pause`);
}

export async function retomarMonitoramento(id: string): Promise<SgaiResult<MonitorResponse>> {
  return sgaiRequest<MonitorResponse>("POST", `/monitor/${encodeURIComponent(id)}/resume`);
}

export async function consultarAtividadesMonitoramento(
  id: string,
  query: { limit: number; cursor?: string },
): Promise<SgaiResult<MonitorActivityResponse>> {
  return sgaiRequest<MonitorActivityResponse>("GET", `/monitor/${encodeURIComponent(id)}/activity`, {
    searchParams: { limit: query.limit, cursor: query.cursor },
  });
}
