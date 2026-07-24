"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import type { ExtractResponse } from "@/server/integrations/web-intelligence/types";
import { CREDITS_QUERY_KEY } from "@/hooks/use-credits";

interface Variables {
  payload: unknown;
  signal?: AbortSignal;
}

export function useExtractMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, signal }: Variables) => apiPost<ExtractResponse>("/api/triad3/extrair", payload, signal),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CREDITS_QUERY_KEY }),
  });
}
