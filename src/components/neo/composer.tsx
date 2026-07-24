"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NEO_MESSAGE_MAX_LENGTH } from "@/lib/neo/limits";

export function Composer({
  value,
  onChange,
  onEnviar,
  onParar,
  emExecucao,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnviar: () => void;
  onParar: () => void;
  emExecucao: boolean;
  disabled?: boolean;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // Controlled `value` is cleared by the parent as part of the same send action, so it alone
  // (not a separate local "sending" flag) is enough to prevent a duplicate submit.
  const podeEnviar = value.trim().length > 0 && !emExecucao && !disabled;
  const proximoDoLimite = value.length > NEO_MESSAGE_MAX_LENGTH * 0.8;

  function enviar() {
    if (!podeEnviar) return;
    onEnviar();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      enviar();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Descreva o que você quer investigar…"
        rows={1}
        maxLength={NEO_MESSAGE_MAX_LENGTH}
        disabled={emExecucao || disabled}
        aria-label="Mensagem para o Neo"
        className="max-h-[200px] min-h-[44px] resize-none border-none font-sans shadow-none focus-visible:ring-0"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-secondary">
          {proximoDoLimite ? `${value.length}/${NEO_MESSAGE_MAX_LENGTH}` : "Enter para enviar · Shift+Enter para quebrar linha"}
        </span>
        {emExecucao ? (
          <Button type="button" variant="destructive" size="sm" onClick={onParar} aria-label="Parar execução">
            <Square className="h-4 w-4" /> Parar
          </Button>
        ) : (
          <Button type="button" size="icon" disabled={!podeEnviar} onClick={enviar} aria-label="Enviar mensagem">
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
