"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NeoConfirmacaoEstado } from "@/hooks/use-neo-stream";

/**
 * Render with `key={confirmacao.etapaId}` at the call site so a new
 * confirmation always mounts a fresh instance — `processando` then resets
 * for free instead of needing an effect to clear it between confirmations.
 */
export function ConfirmationCard({
  confirmacao,
  onConfirmar,
  onCancelar,
}: {
  confirmacao: NeoConfirmacaoEstado;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [processando, setProcessando] = React.useState(false);

  return (
    <div className="rounded-xl border border-warning/40 bg-warning-bg p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Confirmação necessária</p>
          <p className="mt-1 text-sm text-text-primary">{confirmacao.descricao}</p>
          <p className="mt-1 text-xs text-text-secondary">Esta é uma ação com efeito duradouro. Ela só será executada se você confirmar.</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setProcessando(true);
                onConfirmar();
              }}
              disabled={processando}
            >
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setProcessando(true);
                onCancelar();
              }}
              disabled={processando}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
