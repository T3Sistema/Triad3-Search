"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Pause, Pencil, Play, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { JsonTree } from "@/components/viewer/json-tree";
import { LoadingView } from "@/components/viewer/loading-view";
import { ErrorView } from "@/components/viewer/error-view";
import { EmptyState } from "@/components/viewer/empty-state";
import { formatDateTime, formatMilliseconds } from "@/lib/ui/formatting";
import { toneForStatus, translateStatus } from "@/lib/ui/status-labels";
import {
  useDeleteMonitorMutation,
  useMonitorActivity,
  useMonitorDetail,
  usePatchMonitorMutation,
  usePauseMonitorMutation,
  useResumeMonitorMutation,
} from "@/hooks/use-monitor";

export function MonitorDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const detailQuery = useMonitorDetail(id);
  const activityQuery = useMonitorActivity(id);
  const pauseMutation = usePauseMonitorMutation(id);
  const resumeMutation = useResumeMonitorMutation(id);
  const deleteMutation = useDeleteMonitorMutation(id);
  const patchMutation = usePatchMonitorMutation(id);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editInterval, setEditInterval] = React.useState("");

  const openEditDialog = () => {
    setEditName(detailQuery.data?.name ?? "");
    setEditInterval(detailQuery.data?.interval ?? "");
    setEditOpen(true);
  };

  if (detailQuery.isLoading) return <LoadingView />;
  if (detailQuery.isError) return <ErrorView error={detailQuery.error} />;

  const monitor = detailQuery.data;
  const ticks = activityQuery.data?.pages.flatMap((p) => p.ticks ?? []) ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{monitor?.name ?? "Monitor"}</CardTitle>
            <CardDescription>{monitor?.url}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar monitor</DialogTitle>
                  <DialogDescription>Atualize o nome ou o intervalo (cron, em UTC).</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name">Nome</Label>
                    <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-interval">Intervalo (cron, UTC)</Label>
                    <Input id="edit-interval" className="font-mono" value={editInterval} onChange={(e) => setEditInterval(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      patchMutation.mutate(
                        { name: editName, interval: editInterval },
                        {
                          onSuccess: () => {
                            toast.success("Monitor atualizado.");
                            setEditOpen(false);
                          },
                          onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao atualizar."),
                        },
                      )
                    }
                    disabled={patchMutation.isPending}
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {monitor?.status === "active" ? (
              <Button variant="outline" size="sm" onClick={() => pauseMutation.mutate(undefined, { onSuccess: () => toast.success("Monitor pausado.") })}>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => resumeMutation.mutate(undefined, { onSuccess: () => toast.success("Monitor retomado.") })}>
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
                  <AlertDialogTitle>Excluir este monitor?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      deleteMutation.mutate(undefined, {
                        onSuccess: () => {
                          toast.success("Monitor excluído.");
                          router.push("/monitor");
                        },
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
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-text-secondary">Status</dt>
              <dd><Badge variant={toneForStatus(monitor?.status)}>{translateStatus(monitor?.status)}</Badge></dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-secondary">Intervalo</dt>
              <dd className="font-mono">{monitor?.interval}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-text-secondary">Criado em</dt>
              <dd>{formatDateTime(monitor?.createdAt)}</dd>
            </div>
          </dl>
          {monitor?.config !== undefined && <JsonTree data={monitor.config} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Atividade</CardTitle>
            <CardDescription>Histórico de execuções deste monitor.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => activityQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {activityQuery.isLoading ? (
            <LoadingView />
          ) : ticks.length === 0 ? (
            <EmptyState message="Nenhuma execução registrada ainda." />
          ) : (
            <ul className="space-y-3">
              {ticks.map((tick) => (
                <li key={tick.id} className="rounded-lg border border-border bg-white p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {tick.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-error" />
                    )}
                    <span className="text-sm font-medium text-text-primary">
                      {formatDateTime(tick.createdAt)}
                    </span>
                    <Badge variant={toneForStatus(tick.status)}>{translateStatus(tick.status)}</Badge>
                    {typeof tick.elapsedMs === "number" && (
                      <span className="text-xs text-text-secondary">{formatMilliseconds(tick.elapsedMs)}</span>
                    )}
                    {tick.changed !== undefined && (
                      <Badge variant={tick.changed ? "warning" : "neutral"}>{tick.changed ? "Mudança detectada" : "Sem mudanças"}</Badge>
                    )}
                    {tick.id && (
                      <Link href={`/history/${tick.id}`} className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        Ver resultado completo <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                  {tick.diffs !== undefined && Object.keys(tick.diffs as object).length > 0 && (
                    <div className="mt-2">
                      <JsonTree data={tick.diffs} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {activityQuery.hasNextPage && (
            <Button variant="outline" size="sm" onClick={() => activityQuery.fetchNextPage()} disabled={activityQuery.isFetchingNextPage}>
              Carregar mais
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
