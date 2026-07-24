"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, ExternalLink, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ErrorView } from "@/components/viewer/error-view";
import { LoadingView } from "@/components/viewer/loading-view";
import {
  useCrawlPages,
  useCrawlStatus,
  useDeleteCrawlMutation,
  useResumeCrawlMutation,
  useStopCrawlMutation,
} from "@/hooks/use-crawl";
import { downloadJson, downloadText } from "@/lib/download";
import { rowsToCsv, withCsvBom } from "@/lib/csv";
import type { CrawlPageEntry } from "@/lib/scrapegraph/types";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  running: "Em execução",
  completed: "Concluído",
  failed: "Falhou",
  stopped: "Interrompido",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "neutral"> = {
  running: "warning",
  completed: "success",
  failed: "error",
  stopped: "neutral",
};

export function CrawlDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const statusQuery = useCrawlStatus(id);
  const pagesQuery = useCrawlPages(id);
  const stopMutation = useStopCrawlMutation(id);
  const resumeMutation = useResumeCrawlMutation(id);
  const deleteMutation = useDeleteCrawlMutation(id);
  const [loadingAll, setLoadingAll] = React.useState(false);

  const status = statusQuery.data?.status;
  const total = statusQuery.data?.total ?? 0;
  const finished = statusQuery.data?.finished ?? 0;
  const progress = total > 0 ? Math.min(100, Math.round((finished / total) * 100)) : 0;

  const pages: CrawlPageEntry[] = React.useMemo(
    () => pagesQuery.data?.pages.flatMap((p) => p.data ?? []) ?? [],
    [pagesQuery.data],
  );

  const loadAll = async () => {
    setLoadingAll(true);
    try {
      let hasNext = pagesQuery.hasNextPage;
      while (hasNext) {
        const result = await pagesQuery.fetchNextPage();
        hasNext = Boolean(result.hasNextPage);
      }
    } finally {
      setLoadingAll(false);
    }
  };

  const exportJson = () => downloadJson(pages, `crawl-${id}-paginas.json`);
  const exportCsv = () => {
    const csv = withCsvBom(rowsToCsv(pages as Record<string, unknown>[]));
    downloadText(csv, `crawl-${id}-paginas.csv`, "text/csv");
  };

  if (statusQuery.isLoading) return <LoadingView />;
  if (statusQuery.isError) return <ErrorView error={statusQuery.error} />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Crawl {id}</CardTitle>
            <CardDescription>Acompanhamento em tempo real do rastreamento.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => statusQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            {status === "running" && (
              <Button variant="outline" size="sm" onClick={() => stopMutation.mutate(undefined, { onSuccess: () => toast.success("Crawl interrompido.") })}>
                <Pause className="h-3.5 w-3.5" /> Parar
              </Button>
            )}
            {status === "stopped" && (
              <Button variant="outline" size="sm" onClick={() => resumeMutation.mutate(undefined, { onSuccess: () => toast.success("Crawl retomado.") })}>
                <Play className="h-3.5 w-3.5" /> Retomar
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir este crawl?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O registro do crawl será removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      deleteMutation.mutate(undefined, {
                        onSuccess: () => {
                          toast.success("Crawl excluído.");
                          router.push("/crawl");
                        },
                        onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao excluir."),
                      })
                    }
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={STATUS_VARIANT[status ?? ""] ?? "neutral"}>{STATUS_LABELS[status ?? ""] ?? status ?? "—"}</Badge>
            <span className="text-sm text-text-secondary">
              {finished.toLocaleString("pt-BR")} / {total.toLocaleString("pt-BR")} páginas
            </span>
            {statusQuery.data?.createdAt && (
              <span className="text-xs text-text-secondary">
                Iniciado em {new Date(statusQuery.data.createdAt).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Páginas</CardTitle>
            <CardDescription>{pages.length.toLocaleString("pt-BR")} página(s) carregada(s)</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportJson} disabled={pages.length === 0}>
              <Download className="h-3.5 w-3.5" /> Exportar JSON
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={pages.length === 0}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Profund.</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Parent URL</th>
                  <th className="px-3 py-2">Content-Type</th>
                  <th className="px-3 py-2">Links</th>
                  <th className="px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pages.map((page, index) => (
                  <tr key={`${page.url}-${index}`}>
                    <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs" title={page.url}>
                      {page.url}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2">{page.title ?? "—"}</td>
                    <td className="px-3 py-2">{page.depth ?? "—"}</td>
                    <td className="px-3 py-2">{page.status ?? "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-2 font-mono text-xs" title={page.parentUrl}>
                      {page.parentUrl ?? "—"}
                    </td>
                    <td className="px-3 py-2">{page.contentType ?? "—"}</td>
                    <td className="px-3 py-2">{page.linksCount ?? "—"}</td>
                    <td className="px-3 py-2">
                      {page.scrapeReferenceId ? (
                        <Link
                          href={`/history/${page.scrapeReferenceId}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Ver resultado <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {pages.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-text-secondary">
                      Nenhuma página carregada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagesQuery.fetchNextPage()}
              disabled={!pagesQuery.hasNextPage || pagesQuery.isFetchingNextPage || loadingAll}
            >
              Carregar mais
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAll}
              disabled={!pagesQuery.hasNextPage || loadingAll}
            >
              {loadingAll ? "Carregando todas…" : "Carregar todas"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
