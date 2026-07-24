"use client";

import * as React from "react";
import type { NeoAnswer } from "@/lib/neo/answer";
import { Badge } from "@/components/ui/badge";
import { BlocoView } from "@/components/neo/answer-blocks";
import { ExportMenu } from "@/components/neo/export-menu";
import { SafeLink } from "@/components/neo/safe-link";
import { translateNeoAnswerStatus } from "@/lib/ui/status-labels";
import { ChevronDown, ChevronUp } from "lucide-react";

function statusTone(status: NeoAnswer["status"]) {
  if (status === "completo") return "success" as const;
  if (status === "parcial") return "warning" as const;
  return "neutral" as const;
}

export function AnswerView({ mensagemId, answer }: { mensagemId: string; answer: NeoAnswer }) {
  const [fontesAbertas, setFontesAbertas] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant={statusTone(answer.status)}>{translateNeoAnswerStatus(answer.status)}</Badge>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">{answer.titulo}</h2>
        </div>
        <ExportMenu mensagemId={mensagemId} answer={answer} />
      </div>

      <p className="text-sm leading-relaxed text-text-primary">{answer.resumoExecutivo}</p>

      {answer.perguntaNecessaria ? (
        <div className="rounded-xl border border-primary/30 bg-primary-bg p-4 text-sm text-text-primary">
          <p className="font-semibold text-primary">Preciso de mais uma informação</p>
          <p className="mt-1">{answer.perguntaNecessaria}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {answer.blocos.map((bloco, i) => (
          <BlocoView bloco={bloco} key={i} />
        ))}
      </div>

      {answer.informacoesAusentes.length > 0 ? (
        <div className="rounded-xl border border-border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-text-primary">Informações não localizadas</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">
            {answer.informacoesAusentes.map((info, i) => (
              <li key={i}>{info}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.observacoes.length > 0 ? (
        <div className="rounded-xl border border-border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-text-primary">Observações</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">
            {answer.observacoes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.proximasAcoes.length > 0 ? (
        <div className="rounded-xl border border-border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-text-primary">Próximas ações sugeridas</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-secondary">
            {answer.proximasAcoes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.fontes.length > 0 ? (
        <div className="rounded-xl border border-border bg-white">
          <button
            type="button"
            onClick={() => setFontesAbertas((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-expanded={fontesAbertas}
          >
            Todas as fontes ({answer.fontes.length})
            {fontesAbertas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {fontesAbertas ? (
            <ul className="space-y-2 border-t border-border px-4 py-3">
              {answer.fontes.map((f) => (
                <li key={f.id} className="text-sm">
                  <SafeLink href={f.url}>{f.titulo ?? f.url}</SafeLink>
                  {f.dominio ? <span className="ml-2 text-xs text-text-secondary">{f.dominio}</span> : null}
                  {f.dataAcesso ? <span className="ml-2 text-xs text-text-secondary">consultado em {f.dataAcesso}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {answer.status === "parcial" ? (
        <p className="text-xs text-text-secondary">
          Esse relatório foi concluído parcialmente. Envie uma nova mensagem para continuar a investigação.
        </p>
      ) : null}
    </div>
  );
}

