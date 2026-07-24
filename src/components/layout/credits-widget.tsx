"use client";

import { RefreshCw, Coins } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCredits, CREDITS_QUERY_KEY } from "@/hooks/use-credits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CreditsWidget() {
  const { data, isLoading, isFetching, isError } = useCredits();
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries({ queryKey: CREDITS_QUERY_KEY });

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 shadow-sm">
      <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
      <div className="leading-tight">
        <p className="text-xs text-text-secondary">Créditos</p>
        <p className="text-sm font-semibold text-text-primary">
          {isLoading ? "…" : isError ? "indisponível" : (data?.remaining ?? 0).toLocaleString("pt-BR")}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
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
