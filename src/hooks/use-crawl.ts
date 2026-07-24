"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import { CREDITS_QUERY_KEY } from "@/hooks/use-credits";
import type { CrawlPagesResponse, CrawlStatusResponse } from "@/server/integrations/web-intelligence/types";

const TERMINAL_STATUSES = new Set(["completed", "failed", "stopped"]);

export function useCreateCrawlMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => apiPost<CrawlStatusResponse>("/api/triad3/mapear", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CREDITS_QUERY_KEY }),
  });
}

export function useCrawlStatus(id: string | undefined) {
  return useQuery({
    queryKey: ["crawl", id],
    queryFn: ({ signal }) => apiGet<CrawlStatusResponse>(`/api/triad3/mapear/${id}`, signal),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL_STATUSES.has(status)) return false;
      return 3000;
    },
  });
}

export function useCrawlPages(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["crawl-pages", id],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) params.set("cursor", pageParam);
      return apiGet<CrawlPagesResponse>(`/api/triad3/mapear/${id}/paginas?${params.toString()}`, signal);
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.pagination?.nextCursor ?? undefined,
    enabled: Boolean(id),
  });
}

export function useStopCrawlMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<CrawlStatusResponse>(`/api/triad3/mapear/${id}/interromper`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crawl", id] }),
  });
}

export function useResumeCrawlMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<CrawlStatusResponse>(`/api/triad3/mapear/${id}/retomar`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crawl", id] }),
  });
}

export function useDeleteCrawlMutation(id: string) {
  return useMutation({
    mutationFn: () => apiDelete(`/api/triad3/mapear/${id}`),
  });
}
