"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { CreditsResponse } from "@/lib/scrapegraph/types";

export const CREDITS_QUERY_KEY = ["credits"] as const;

export function useCredits() {
  return useQuery({
    queryKey: CREDITS_QUERY_KEY,
    queryFn: ({ signal }) => apiGet<CreditsResponse>("/api/sgai/credits", signal),
    staleTime: 30_000,
    retry: 1,
  });
}
