"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { CREDITS_QUERY_KEY } from "@/hooks/use-credits";
import type { MonitorActivityResponse, MonitorListResponse, MonitorResponse } from "@/server/integrations/web-intelligence/types";

export function useCreateMonitorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => apiPost<MonitorResponse>("/api/triad3/monitoramentos", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CREDITS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["monitor-list"] });
    },
  });
}

export function useMonitorList() {
  return useQuery({
    queryKey: ["monitor-list"],
    queryFn: ({ signal }) => apiGet<MonitorListResponse>("/api/triad3/monitoramentos?limit=50", signal),
  });
}

export function useMonitorDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["monitor", id],
    queryFn: ({ signal }) => apiGet<MonitorResponse>(`/api/triad3/monitoramentos/${id}`, signal),
    enabled: Boolean(id),
  });
}

export function useMonitorActivity(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["monitor-activity", id],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam) params.set("cursor", pageParam);
      return apiGet<MonitorActivityResponse>(`/api/triad3/monitoramentos/${id}/atividades?${params.toString()}`, signal);
    },
    initialPageParam: "" as string,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(id),
  });
}

export function usePauseMonitorMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<MonitorResponse>(`/api/triad3/monitoramentos/${id}/pausar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["monitor-list"] });
    },
  });
}

export function useResumeMonitorMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<MonitorResponse>(`/api/triad3/monitoramentos/${id}/retomar`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["monitor-list"] });
    },
  });
}

export function useDeleteMonitorMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete(`/api/triad3/monitoramentos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["monitor-list"] }),
  });
}

export function usePatchMonitorMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) => apiPatch<MonitorResponse>(`/api/triad3/monitoramentos/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitor", id] });
      queryClient.invalidateQueries({ queryKey: ["monitor-list"] });
    },
  });
}
