"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingView } from "@/components/viewer/loading-view";
import { ErrorView } from "@/components/viewer/error-view";
import { EmptyState } from "@/components/viewer/empty-state";
import { useHistoryList } from "@/hooks/use-history";
import { HISTORY_SERVICES } from "@/lib/scrapegraph/schemas";

const SERVICE_LABELS: Record<string, string> = {
  scrape: "Scrape",
  extract: "Extract",
  search: "Search",
  monitor: "Monitor",
  crawl: "Crawl",
  schema: "Schema",
};

export function HistoryPage() {
  const [page, setPage] = React.useState(1);
  const [service, setService] = React.useState<string>("all");
  const limit = 20;

  const { data, isLoading, isError, error, refetch, isFetching } = useHistoryList({
    page,
    limit,
    service: service !== "all" ? service : undefined,
  });

  const items = data?.data ?? [];
  const total = data?.pagination?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Requisições realizadas através deste painel.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={service} onValueChange={(v) => { setService(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os serviços</SelectItem>
              {HISTORY_SERVICES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SERVICE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <LoadingView />
        ) : isError ? (
          <ErrorView error={error} />
        ) : items.length === 0 ? (
          <EmptyState message="Nenhuma requisição encontrada." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Serviço</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duração</th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "—"}</td>
                      <td className="px-3 py-2">{SERVICE_LABELS[String(item.service)] ?? item.service}</td>
                      <td className="px-3 py-2">
                        <Badge variant={item.status === "completed" ? "success" : item.status === "failed" ? "error" : "neutral"}>
                          {item.status ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{typeof item.elapsedMs === "number" ? `${item.elapsedMs.toLocaleString("pt-BR")} ms` : "—"}</td>
                      <td className="max-w-[160px] truncate px-3 py-2 font-mono text-xs" title={item.id}>{item.id}</td>
                      <td className="px-3 py-2">
                        <Link href={`/history/${item.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                          Abrir <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-text-secondary">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
