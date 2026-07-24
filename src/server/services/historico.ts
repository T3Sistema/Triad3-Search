import "server-only";
import { sgaiRequest, type SgaiResult } from "@/server/integrations/web-intelligence/client";
import type { HistoryService } from "@/server/integrations/web-intelligence/types";
import type { HistoryItem, HistoryListResponse } from "@/server/integrations/web-intelligence/types";

/** Shared service behind the manual "Histórico" module and the Neo "consultar histórico" tool. */
export async function listarHistorico(query: {
  page: number;
  limit: number;
  service?: HistoryService | string;
  status?: string;
}): Promise<SgaiResult<HistoryListResponse>> {
  return sgaiRequest<HistoryListResponse>("GET", "/history", {
    searchParams: { page: query.page, limit: query.limit, service: query.service, status: query.status },
  });
}

export async function consultarHistorico(id: string): Promise<SgaiResult<HistoryItem>> {
  return sgaiRequest<HistoryItem>("GET", `/history/${encodeURIComponent(id)}`);
}
