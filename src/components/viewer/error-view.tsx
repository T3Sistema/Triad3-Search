"use client";

import { AlertCircle } from "lucide-react";
import { ApiRequestError } from "@/lib/api-client";

const TYPE_LABELS: Record<string, string> = {
  configuration: "Configuração ausente",
  validation: "Dados inválidos",
  authentication: "Falha de autenticação",
  payment_required: "Créditos insuficientes",
  forbidden: "Acesso negado",
  not_found: "Não encontrado",
  rate_limit: "Limite atingido",
  server_error: "Erro no serviço",
  network: "Falha de rede",
  timeout: "Tempo esgotado",
  unknown: "Erro inesperado",
};

export function ErrorView({ error }: { error: unknown }) {
  const apiError = error instanceof ApiRequestError ? error : null;
  const message = apiError?.message ?? (error instanceof Error ? error.message : "Ocorreu um erro inesperado.");
  const type = apiError?.type ?? "unknown";

  return (
    <div className="space-y-2 rounded-lg border border-error/30 bg-error-bg p-4">
      <div className="flex items-center gap-2 text-error">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">{TYPE_LABELS[type] ?? "Erro"}</p>
      </div>
      <p className="text-sm text-text-primary">{message}</p>
      {apiError?.originalMessage && (
        <p className="text-xs text-text-secondary">Mensagem original: {apiError.originalMessage}</p>
      )}
      {apiError?.details !== undefined && apiError.details !== null && (
        <pre className="max-h-40 overflow-auto rounded-md bg-white/60 p-2 text-xs text-text-secondary">
          {JSON.stringify(apiError.details, null, 2)}
        </pre>
      )}
    </div>
  );
}
