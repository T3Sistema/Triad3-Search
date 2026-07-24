"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useNeoExecucao } from "@/hooks/use-neo-conversas";

function EtapaIcon({ status }: { status: string }) {
  if (status === "concluida" || status === "parcial") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />;
  if (status === "falhou" || status === "cancelada") return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-error" aria-hidden="true" />;
  return <Loader2 className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden="true" />;
}

/** On-demand step history for a finished/interrupted execution — fetched only when expanded. */
export function EtapasConcluidasList({ execucaoId }: { execucaoId: string }) {
  const [aberto, setAberto] = React.useState(false);
  const query = useNeoExecucao(execucaoId, { enabled: aberto });

  return (
    <div className="rounded-lg border border-border bg-white">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-text-secondary hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={aberto}
      >
        Ver etapas concluídas
        {aberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {aberto ? (
        <div className="space-y-1.5 border-t border-border px-3 py-2">
          {query.isLoading ? <p className="text-xs text-text-secondary">Carregando…</p> : null}
          {query.data?.etapas.map((etapa) => (
            <div key={etapa.id} className="flex items-center gap-2 text-xs">
              <EtapaIcon status={etapa.status} />
              <span className="text-text-primary">{etapa.nomePublico}</span>
            </div>
          ))}
          {query.data && query.data.etapas.length === 0 ? <p className="text-xs text-text-secondary">Nenhuma etapa registrada.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
