"use client";

import { RefreshCw, Coins } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCredits, CREDITS_QUERY_KEY } from "@/hooks/use-credits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/ui/formatting";

export function CreditsWidget() {
  const { data, isLoading, isFetching, isError } = useCredits();
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries({ queryKey: CREDITS_QUERY_KEY });

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-1.5 shadow-sm sm:gap-2 sm:px-3">
      <Coins className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="leading-tight">
        <p className="hidden text-xs text-text-secondary sm:block">Créditos</p>
        <p className="text-sm font-semibold text-text-primary">
          {isLoading ? "…" : isError ? "indisponível" : formatNumber(data?.remaining ?? 0)}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden h-7 w-7 sm:flex sm:h-9 sm:w-9"
        onClick={refresh}
        disabled={isFetching}
        aria-label="Atualizar créditos"
        title="Atualizar créditos"
      >
        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      </Button>
    </div>
  );
}
