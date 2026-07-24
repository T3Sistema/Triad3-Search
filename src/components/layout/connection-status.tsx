"use client";

import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { useCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import { ApiRequestError } from "@/lib/api-client";

export function ConnectionStatus() {
  const { isLoading, isError, error } = useCredits();

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Verificando conexão
      </span>
    );
  }

  if (isError) {
    const isConfig = error instanceof ApiRequestError && error.type === "configuration";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          isConfig ? "text-warning" : "text-error",
        )}
        title={error instanceof Error ? error.message : undefined}
      >
        {isConfig ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        {isConfig ? "Chave não configurada" : "Sem conexão"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Conectado
    </span>
  );
}
