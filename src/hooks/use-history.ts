"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { HistoryItem, HistoryListResponse } from "@/server/integrations/web-intelligence/types";

export interface HistoryFilters {
  page: number;
  limit: number;
  service?: string;
  status?: string;
}

export function useHistoryList(filters: HistoryFilters) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  if (filters.service) params.set("service", filters.service);
  if (filters.status) params.set("status", filters.status);

  return useQuery({
    queryKey: ["history", filters],
    queryFn: ({ signal }) => apiGet<HistoryListResponse>(`/api/triad3/historico?${params.toString()}`, signal),
  });
}

export function useHistoryDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["history-item", id],
    queryFn: ({ signal }) => apiGet<HistoryItem>(`/api/triad3/historico/${id}`, signal),
    enabled: Boolean(id),
  });
}
