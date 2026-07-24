"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NeoEtapaEstado } from "@/hooks/use-neo-stream";

function EtapaIcon({ status }: { status: NeoEtapaEstado["status"] }) {
  if (status === "concluida") return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />;
  if (status === "falhou") return <CircleAlert className="h-4 w-4 shrink-0 text-error" aria-hidden="true" />;
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden="true" />;
}

export function ExecutionProgress({
  objetivo,
  etapasPrevistas,
  etapas,
  motivoParcial,
  emExecucao,
}: {
  objetivo: string | null;
  etapasPrevistas: string[];
  etapas: NeoEtapaEstado[];
  motivoParcial: string | null;
  emExecucao: boolean;
}) {
  const [aberto, setAberto] = React.useState(true);

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary-bg/40 to-white p-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={aberto}
        aria-live="polite"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          {emExecucao ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
          {objetivo ?? "Planejando a investigação…"}
        </span>
        {aberto ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
      </button>

      {aberto ? (
        <div className="mt-3 space-y-2">
          {etapas.length === 0 && etapasPrevistas.length > 0 ? (
            <ul className="space-y-1 text-xs text-text-secondary">
              {etapasPrevistas.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          ) : null}

          {etapas.map((etapa) => (
            <div key={etapa.id} className={cn("flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm", etapa.status === "falhou" && "bg-error-bg/50")}>
              <EtapaIcon status={etapa.status} />
              <div className="min-w-0">
                <p className="truncate text-text-primary">{etapa.nomePublico}</p>
                {etapa.resumo ? <p className="text-xs text-text-secondary">{etapa.resumo}</p> : null}
                {etapa.mensagem ? <p className="text-xs text-error">{etapa.mensagem}</p> : null}
              </div>
            </div>
          ))}

          {motivoParcial ? <p className="text-xs text-warning">{motivoParcial}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
