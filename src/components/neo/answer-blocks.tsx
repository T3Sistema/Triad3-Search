"use client";

import type { NeoBloco } from "@/lib/neo/answer";
import { Badge } from "@/components/ui/badge";
import { MarkdownView } from "@/components/viewer/markdown-view";
import { SafeImage } from "@/components/neo/safe-image";
import { SafeLink } from "@/components/neo/safe-link";
import {
  translateAlertaCategoria,
  translateNivelEvidencia,
  toneForNivelEvidencia,
  translatePapelPessoa,
} from "@/lib/ui/status-labels";
import { AlertTriangle, AtSign, Heart, MessageCircle, User2 } from "lucide-react";

function BlockCard({ title, children }: { title?: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      {title ? <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3> : null}
      {children}
    </div>
  );
}

function EvidenceBadge({ nivel }: { nivel: string }) {
  const tone = toneForNivelEvidencia(nivel);
  return <Badge variant={tone === "success" ? "success" : tone === "error" ? "error" : tone === "warning" ? "warning" : "neutral"}>{translateNivelEvidencia(nivel)}</Badge>;
}

function FatoItem({ fato }: { fato: { rotulo: string; valor: string; nivelEvidencia: string; dataObservacao: string | null } }) {
  return (
    <div className="rounded-lg border border-border/70 bg-app-bg/30 p-3">
      <dt className="text-xs font-medium text-text-secondary">{fato.rotulo}</dt>
      <dd className="mt-1 text-sm font-medium text-text-primary">{fato.valor}</dd>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <EvidenceBadge nivel={fato.nivelEvidencia} />
        {fato.dataObservacao ? <span className="text-xs text-text-secondary">Observado em {fato.dataObservacao}</span> : null}
      </div>
    </div>
  );
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
              <FatoItem key={i} fato={f} />
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
              {bloco.identificadores.length > 0 ? (
                <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  {bloco.identificadores.map((a, i) => (
                    <li key={i}>
                      <span className="text-text-secondary">{a.rotulo}:</span> <span className="font-medium">{a.valor}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {bloco.atributos.length > 0 ? (
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {bloco.atributos.map((a, i) => (
                    <FatoItem key={i} fato={a} />
                  ))}
                </dl>
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

    case "pessoa":
      return (
        <BlockCard>
          <div className="flex flex-col gap-4 sm:flex-row">
            {bloco.fotoUrl ? (
              <SafeImage src={bloco.fotoUrl} alt={bloco.nome} className="h-24 w-24 shrink-0 rounded-full" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-slate-50 text-text-secondary">
                <User2 className="h-8 w-8" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-text-primary">{bloco.nome}</h3>
              {bloco.papeis.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {bloco.papeis.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-full border border-border bg-app-bg/40 px-2.5 py-1 text-xs">
                      <span className="font-medium text-text-primary">{translatePapelPessoa(p.classificacao)}</span>
                      <EvidenceBadge nivel={p.nivelEvidencia} />
                    </div>
                  ))}
                </div>
              ) : null}
              {bloco.organizacoesRelacionadas.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {bloco.organizacoesRelacionadas.map((o, i) => (
                    <li key={i}>
                      <span className="font-medium text-text-primary">{o.nome}</span>{" "}
                      <span className="text-text-secondary">— {o.relacao}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {bloco.atributos.length > 0 ? (
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  {bloco.atributos.map((a, i) => (
                    <FatoItem key={i} fato={a} />
                  ))}
                </dl>
              ) : null}
            </div>
          </div>
        </BlockCard>
      );

    case "perfil_social":
      return (
        <BlockCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {bloco.fotoUrl ? (
              <SafeImage src={bloco.fotoUrl} alt={bloco.nome} className="h-20 w-20 shrink-0 rounded-full" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-slate-50 text-text-secondary">
                <User2 className="h-7 w-7" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-text-primary">{bloco.nome}</h3>
                {bloco.arroba ? (
                  <span className="flex items-center gap-0.5 text-sm text-text-secondary">
                    <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                    {bloco.arroba}
                  </span>
                ) : null}
              </div>
              {bloco.bio ? <p className="mt-1 text-sm text-text-primary">{bloco.bio}</p> : null}
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {bloco.seguidores ? (
                  <span>
                    <span className="font-semibold text-text-primary">{bloco.seguidores}</span>{" "}
                    <span className="text-text-secondary">seguidores</span>
                  </span>
                ) : null}
                {bloco.seguindo ? (
                  <span>
                    <span className="font-semibold text-text-primary">{bloco.seguindo}</span>{" "}
                    <span className="text-text-secondary">seguindo</span>
                  </span>
                ) : null}
                {bloco.publicacoes ? (
                  <span>
                    <span className="font-semibold text-text-primary">{bloco.publicacoes}</span>{" "}
                    <span className="text-text-secondary">publicações</span>
                  </span>
                ) : null}
              </div>
              {bloco.relacao ? <p className="mt-2 text-xs text-text-secondary">{bloco.relacao}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                {bloco.metricaVariavel ? <Badge variant="warning">Métrica variável</Badge> : null}
                {bloco.dataObservacao ? <span>Consultado em {bloco.dataObservacao}</span> : null}
              </div>
              {bloco.url ? (
                <div className="mt-2">
                  <SafeLink href={bloco.url}>Ver perfil</SafeLink>
                </div>
              ) : null}
            </div>
          </div>
        </BlockCard>
      );

    case "publicacao":
      return (
        <BlockCard>
          <div className="flex flex-col gap-4 sm:flex-row">
            {bloco.midiaUrl ? <SafeImage src={bloco.midiaUrl} alt={bloco.legenda ?? "Publicação"} className="h-40 w-40 shrink-0" /> : null}
            <div className="min-w-0 flex-1">
              {bloco.legenda ? <p className="text-sm text-text-primary">{bloco.legenda}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                {bloco.dataPublicacao ? <span>{bloco.dataPublicacao}</span> : null}
                {bloco.curtidas ? (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {bloco.curtidas}
                  </span>
                ) : null}
                {bloco.comentarios ? (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {bloco.comentarios}
                  </span>
                ) : null}
                {bloco.outrasMetricas.map((m, i) => (
                  <span key={i}>
                    {m.rotulo}: {m.valor}
                  </span>
                ))}
              </div>
              {bloco.contexto ? <p className="mt-2 text-sm text-text-secondary">{bloco.contexto}</p> : null}
              {bloco.url ? (
                <div className="mt-2">
                  <SafeLink href={bloco.url}>Ver publicação original</SafeLink>
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

    default:
      return null;
  }
}
