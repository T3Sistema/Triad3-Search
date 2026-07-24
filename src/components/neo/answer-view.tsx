"use client";

import * as React from "react";
import type { NeoAnswer } from "@/lib/neo/answer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlocoView } from "@/components/neo/answer-blocks";
import { ExportMenu } from "@/components/neo/export-menu";
import { SafeLink } from "@/components/neo/safe-link";
import { MarkdownView } from "@/components/viewer/markdown-view";
import { buildFonteUsageMap } from "@/lib/neo/fonte-usage";
import { useNeoExecucao } from "@/hooks/use-neo-conversas";
import {
  translateNeoAnswerStatus,
  translateNivelEvidencia,
  toneForNivelEvidencia,
  translateLacunaTipo,
  translateEvidenciaMatrizClassificacao,
} from "@/lib/ui/status-labels";
import { formatDateTime } from "@/lib/ui/formatting";
import { ChevronDown, ChevronUp, PlayCircle } from "lucide-react";

function statusTone(status: NeoAnswer["status"]) {
  if (status === "completo") return "success" as const;
  if (status === "parcial") return "warning" as const;
  return "neutral" as const;
}

function evidenceTone(nivel: string) {
  const tone = toneForNivelEvidencia(nivel);
  return tone === "success" ? ("success" as const) : tone === "error" ? ("error" as const) : tone === "warning" ? ("warning" as const) : ("neutral" as const);
}

function CitationRefs({ fontesIds, fonteIndex, onCitar }: { fontesIds: string[]; fonteIndex: Map<string, number>; onCitar: () => void }) {
  const validos = fontesIds.map((id) => fonteIndex.get(id)).filter((n): n is number => typeof n === "number");
  if (validos.length === 0) return null;
  return (
    <span className="ml-1 inline-flex gap-0.5 align-super text-[0.65rem] font-medium text-primary">
      {validos.map((n) => (
        <button
          key={n}
          type="button"
          onClick={onCitar}
          className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Ver fonte ${n}`}
        >
          [{n}]
        </button>
      ))}
    </span>
  );
}

export interface AnswerViewProps {
  mensagemId: string;
  answer: NeoAnswer;
  /** Message creation timestamp — used for "Gerado em", never trusted from the model itself. */
  geradoEm?: string | null;
  /** When provided, shows a discreet "N operações realizadas · M fontes utilizadas" line — never "N links encontrados" as if that were the result. */
  execucaoId?: string | null;
  onContinuar?: () => void;
}

export function AnswerView({ mensagemId, answer, geradoEm, execucaoId, onContinuar }: AnswerViewProps) {
  const [fontesAbertas, setFontesAbertas] = React.useState(false);
  const fonteUsage = React.useMemo(() => buildFonteUsageMap(answer), [answer]);
  const fonteIndex = React.useMemo(() => new Map(answer.fontes.map((f, i) => [f.id, i + 1])), [answer.fontes]);
  const abrirFontes = React.useCallback(() => setFontesAbertas(true), []);
  const execucaoQuery = useNeoExecucao(execucaoId ?? undefined, { enabled: Boolean(execucaoId) });
  const operacoesRealizadas = execucaoQuery.data?.etapas.filter((e) => e.tipo === "ferramenta").length;

  const podeContinuar = answer.status === "parcial" && answer.lacunas.length > 0 && Boolean(onContinuar);
  const temAchadosOuResposta = answer.achados.length > 0 || Boolean(answer.respostaDireta);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
          <span>Neo · Relatório de inteligência</span>
          <Badge variant={statusTone(answer.status)}>{translateNeoAnswerStatus(answer.status)}</Badge>
        </div>
        <h2 className="text-xl font-semibold leading-snug text-text-primary">{answer.titulo}</h2>
        {answer.objetivo ? <p className="text-sm text-text-secondary">{answer.objetivo}</p> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          <span>
            {answer.fontes.length} fonte{answer.fontes.length === 1 ? "" : "s"} consultada{answer.fontes.length === 1 ? "" : "s"}
          </span>
          {geradoEm ? <span>Gerado em {formatDateTime(geradoEm)}</span> : null}
        </div>
        {typeof operacoesRealizadas === "number" ? (
          <p className="text-xs text-text-secondary">
            {operacoesRealizadas} operaç{operacoesRealizadas === 1 ? "ão" : "ões"} realizada{operacoesRealizadas === 1 ? "" : "s"} · {answer.fontes.length} fonte
            {answer.fontes.length === 1 ? "" : "s"} utilizada{answer.fontes.length === 1 ? "" : "s"}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ExportMenu mensagemId={mensagemId} answer={answer} />
          {podeContinuar ? (
            <Button variant="primary" size="sm" onClick={onContinuar}>
              <PlayCircle className="h-4 w-4" /> Continuar investigação
            </Button>
          ) : null}
        </div>
      </header>

      {answer.perguntaNecessaria ? (
        <div className="rounded-xl border border-primary/30 bg-primary-bg p-4 text-sm text-text-primary">
          <p className="font-semibold text-primary">Preciso de mais uma informação</p>
          <p className="mt-1">{answer.perguntaNecessaria}</p>
        </div>
      ) : null}

      {answer.indicadoresPrincipais.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {answer.indicadoresPrincipais.slice(0, 3).map((ind, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{ind.rotulo}</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{ind.valor}</p>
              {ind.descricao ? <p className="mt-1 text-xs text-text-secondary">{ind.descricao}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {temAchadosOuResposta ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {answer.achados.length > 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">O que a investigação encontrou</h3>
              <ol className="space-y-3">
                {answer.achados.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-bg text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {a.conclusao}
                        <CitationRefs fontesIds={a.fontesIds} fonteIndex={fonteIndex} onCitar={abrirFontes} />
                      </p>
                      {a.explicacao ? <p className="mt-0.5 text-sm text-text-secondary">{a.explicacao}</p> : null}
                      <div className="mt-1">
                        <Badge variant={evidenceTone(a.nivelEvidencia)}>{translateNivelEvidencia(a.nivelEvidencia)}</Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {answer.respostaDireta ? (
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
              <h3 className="mb-3 text-sm font-semibold text-text-primary">Resposta do Neo</h3>
              <MarkdownView content={answer.respostaDireta} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4">
        {answer.blocos.map((bloco, i) => (
          <BlocoView bloco={bloco} key={i} />
        ))}
      </div>

      {answer.lacunas.length > 0 ? (
        <div className="rounded-xl border border-border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-text-primary">O que ainda merece apuração</p>
          <ul className="mt-2 space-y-2">
            {answer.lacunas.map((l, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 text-sm text-text-secondary">
                <Badge variant="neutral">{translateLacunaTipo(l.tipo)}</Badge>
                <span>{l.descricao}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {answer.matrizEvidencias.length > 0 ? (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-sm font-semibold text-text-primary">Como cada conclusão foi sustentada</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-semibold text-text-primary">Conclusão</th>
                  <th className="px-3 py-2 font-semibold text-text-primary">Evidência</th>
                  <th className="px-3 py-2 font-semibold text-text-primary">Classificação</th>
                </tr>
              </thead>
              <tbody>
                {answer.matrizEvidencias.map((m, i) => (
                  <tr key={i} className="border-b border-border/60 align-top">
                    <td className="px-3 py-2 text-text-primary">{m.conclusao}</td>
                    <td className="px-3 py-2 text-text-secondary">{m.evidencia}</td>
                    <td className="px-3 py-2">
                      <Badge variant={evidenceTone(m.classificacao)}>{translateEvidenciaMatrizClassificacao(m.classificacao)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            Ver as fontes consultadas ({answer.fontes.length})
            {fontesAbertas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {fontesAbertas ? (
            <ul className="space-y-3 border-t border-border px-4 py-3">
              {answer.fontes.map((f, i) => {
                const sustenta = fonteUsage.get(f.id);
                return (
                  <li key={f.id} className="text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs font-semibold text-text-secondary">[{i + 1}]</span>
                      <SafeLink href={f.url}>{f.titulo ?? f.url}</SafeLink>
                      {f.dominio ? <span className="text-xs text-text-secondary">{f.dominio}</span> : null}
                      {f.dataAcesso ? <span className="text-xs text-text-secondary">consultado em {f.dataAcesso}</span> : null}
                    </div>
                    {sustenta && sustenta.length > 0 ? <p className="mt-0.5 text-xs text-text-secondary">Sustenta: {sustenta.join(", ")}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <footer className="space-y-1 border-t border-border pt-3 text-xs text-text-secondary">
        <p>Os dados representam o momento da consulta e podem ter mudado desde então.</p>
        <p>Informações sensíveis ou de natureza formal devem ser validadas antes de qualquer uso oficial.</p>
        {geradoEm ? <p>Relatório gerado em {formatDateTime(geradoEm)}.</p> : null}
      </footer>
    </div>
  );
}
