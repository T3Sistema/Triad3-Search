"use client";

import type { NeoBloco } from "@/lib/neo/answer";
import { Badge } from "@/components/ui/badge";
import { MarkdownView } from "@/components/viewer/markdown-view";
import { SafeImage } from "@/components/neo/safe-image";
import { SafeLink } from "@/components/neo/safe-link";
import { translateAlertaCategoria, translateNivelEvidencia, toneForNivelEvidencia } from "@/lib/ui/status-labels";
import { AlertTriangle } from "lucide-react";

function BlockCard({ title, children }: { title?: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      {title ? <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3> : null}
      {children}
    </div>
  );
}

function EvidenceBadge({ nivel }: { nivel: string }) {
  return <Badge variant={toneForNivelEvidencia(nivel) === "success" ? "success" : toneForNivelEvidencia(nivel) === "error" ? "error" : toneForNivelEvidencia(nivel) === "warning" ? "warning" : "neutral"}>{translateNivelEvidencia(nivel)}</Badge>;
}

export function BlocoView({ bloco }: { bloco: NeoBloco }) {
  switch (bloco.tipo) {
    case "texto":
      return (
        <BlockCard title={bloco.titulo}>
          <MarkdownView content={bloco.conteudo} />
        </BlockCard>
      );

    case "fatos":
      return (
        <BlockCard title={bloco.titulo ?? "Fatos"}>
          <dl className="grid gap-3 sm:grid-cols-2">
            {bloco.itens.map((f, i) => (
              <div key={i} className="rounded-lg border border-border/70 bg-app-bg/30 p-3">
                <dt className="text-xs font-medium text-text-secondary">{f.rotulo}</dt>
                <dd className="mt-1 text-sm font-medium text-text-primary">{f.valor}</dd>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <EvidenceBadge nivel={f.nivelEvidencia} />
                  {f.dataObservacao ? <span className="text-xs text-text-secondary">Observado em {f.dataObservacao}</span> : null}
                </div>
              </div>
            ))}
          </dl>
        </BlockCard>
      );

    case "entidade":
      return (
        <BlockCard>
          <div className="flex flex-col gap-4 sm:flex-row">
            {bloco.imagemUrl ? <SafeImage src={bloco.imagemUrl} alt={bloco.nome} className="h-28 w-28 shrink-0" /> : null}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-text-primary">{bloco.nome}</h3>
              {bloco.subtitulo ? <p className="text-sm text-text-secondary">{bloco.subtitulo}</p> : null}
              {bloco.descricao ? <p className="mt-2 text-sm text-text-primary">{bloco.descricao}</p> : null}
              {bloco.atributos.length > 0 ? (
                <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  {bloco.atributos.map((a, i) => (
                    <li key={i}>
                      <span className="text-text-secondary">{a.rotulo}:</span> <span className="font-medium">{a.valor}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {bloco.links.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {bloco.links.map((l, i) => (
                    <SafeLink key={i} href={l.url}>
                      {l.rotulo}
                    </SafeLink>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </BlockCard>
      );

    case "metricas":
      return (
        <BlockCard title={bloco.titulo ?? "Métricas"}>
          <div className="grid gap-3 sm:grid-cols-3">
            {bloco.itens.map((m, i) => (
              <div key={i} className="rounded-lg border border-border/70 bg-app-bg/30 p-3">
                <p className="text-xs font-medium text-text-secondary">{m.rotulo}</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {m.valor}
                  {m.unidade ? <span className="ml-1 text-sm font-normal text-text-secondary">{m.unidade}</span> : null}
                </p>
                {m.comparacao ? <p className="text-xs text-text-secondary">{m.comparacao}</p> : null}
                {m.dataObservacao ? <p className="text-xs text-text-secondary">Observado em {m.dataObservacao}</p> : null}
              </div>
            ))}
          </div>
        </BlockCard>
      );

    case "imagem":
      return (
        <BlockCard>
          <SafeImage src={bloco.url} alt={bloco.textoAlternativo} className="max-h-96" />
          {bloco.legenda ? <p className="mt-2 text-xs text-text-secondary">{bloco.legenda}</p> : null}
        </BlockCard>
      );

    case "tabela":
      return (
        <BlockCard title={bloco.titulo}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {bloco.colunas.map((c, i) => (
                    <th key={i} className="px-3 py-2 font-semibold text-text-primary">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bloco.linhas.map((linha, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {linha.map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-text-primary">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BlockCard>
      );

    case "timeline":
      return (
        <BlockCard title={bloco.titulo ?? "Linha do tempo"}>
          <ol className="space-y-4 border-l border-border pl-4">
            {bloco.itens.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                {e.data ? <p className="text-xs font-medium text-text-secondary">{e.data}</p> : null}
                <p className="text-sm font-medium text-text-primary">{e.titulo}</p>
                {e.descricao ? <p className="text-sm text-text-secondary">{e.descricao}</p> : null}
              </li>
            ))}
          </ol>
        </BlockCard>
      );

    case "relacoes":
      return (
        <BlockCard title={bloco.titulo ?? "Relações"}>
          <ul className="space-y-2">
            {bloco.itens.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{r.origem}</Badge>
                <span className="text-text-secondary">{r.relacao}</span>
                <Badge variant="outline">{r.destino}</Badge>
                {r.evidencia ? <span className="text-xs text-text-secondary">— {r.evidencia}</span> : null}
              </li>
            ))}
          </ul>
        </BlockCard>
      );

    case "alerta":
      return (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-bg p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">{translateAlertaCategoria(bloco.categoria)}</p>
            <p className="mt-1 text-sm text-text-primary">{bloco.mensagem}</p>
          </div>
        </div>
      );

    case "fontes":
      return (
        <BlockCard title="Fontes">
          <ul className="space-y-2">
            {bloco.itens.map((f, i) => (
              <li key={i} className="text-sm">
                <SafeLink href={f.url}>{f.titulo ?? f.url}</SafeLink>
                {f.dominio ? <span className="ml-2 text-xs text-text-secondary">{f.dominio}</span> : null}
                {f.dataAcesso ? <span className="ml-2 text-xs text-text-secondary">consultado em {f.dataAcesso}</span> : null}
              </li>
            ))}
          </ul>
        </BlockCard>
      );

    default:
      return null;
  }
}
