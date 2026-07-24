"use client";

import * as React from "react";
import { toast } from "sonner";
import { Play, Pause, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { FormatSelector } from "@/components/playground/format-selector";
import {
  DEFAULT_FETCH_CONFIG_FORM,
  FetchConfigAccordion,
  toFetchConfigPayload,
  type FetchConfigFormValue,
} from "@/components/playground/fetch-config";
import { RequestPreview } from "@/components/playground/request-preview";
import { LoadingView } from "@/components/viewer/loading-view";
import { ErrorView } from "@/components/viewer/error-view";
import { EmptyState } from "@/components/viewer/empty-state";
import { useCreateMonitorMutation, useDeleteMonitorMutation, useMonitorList, usePauseMonitorMutation, useResumeMonitorMutation } from "@/hooks/use-monitor";
import { isHttpUrl } from "@/lib/url";
import { toneForStatus, translateStatus } from "@/lib/ui/status-labels";
import type { ScrapeFormat } from "@/lib/integration/formats";
import type { MonitorResponse } from "@/server/integrations/web-intelligence/types";

const CRON_PRESETS = [
  { value: "*/10 * * * *", label: "A cada 10 minutos" },
  { value: "*/30 * * * *", label: "A cada 30 minutos" },
  { value: "0 * * * *", label: "A cada hora" },
  { value: "0 */6 * * *", label: "A cada 6 horas" },
  { value: "0 9 * * *", label: "Diariamente (09:00 UTC)" },
  { value: "custom", label: "Personalizado" },
];

export function MonitorPage() {
  const [tab, setTab] = React.useState("create");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="create">Criar monitor</TabsTrigger>
        <TabsTrigger value="manage">Meus monitores</TabsTrigger>
      </TabsList>
      <TabsContent value="create">
        <CreateMonitorTab onCreated={() => setTab("manage")} />
      </TabsContent>
      <TabsContent value="manage">
        <ManageMonitorsTab />
      </TabsContent>
    </Tabs>
  );
}

function CreateMonitorTab({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [preset, setPreset] = React.useState("*/30 * * * *");
  const [customInterval, setCustomInterval] = React.useState("");
  const [formats, setFormats] = React.useState<ScrapeFormat[]>([{ type: "markdown", mode: "reader" }]);
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [fetchConfig, setFetchConfig] = React.useState<FetchConfigFormValue>(DEFAULT_FETCH_CONFIG_FORM);

  const mutation = useCreateMonitorMutation();
  const interval = preset === "custom" ? customInterval : preset;

  const requestBody = React.useMemo(() => {
    const prunedFetchConfig = toFetchConfigPayload(fetchConfig);
    return {
      name: name || "Meu monitor",
      url: url || "https://example.com",
      interval: interval || "*/30 * * * *",
      formats,
      ...(webhookUrl ? { webhookUrl } : {}),
      ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
    };
  }, [name, url, interval, formats, webhookUrl, fetchConfig]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    if (!name.trim()) {
      toast.error("Informe um nome para o monitor.");
      return;
    }
    if (!url.trim() || !isHttpUrl(url)) {
      setUrlError("Informe uma URL pública válida (http ou https).");
      return;
    }
    if (!interval.trim()) {
      toast.error("Informe o intervalo em formato cron.");
      return;
    }
    if (formats.length === 0) {
      toast.error("Selecione ao menos um formato.");
      return;
    }
    if (webhookUrl && !isHttpUrl(webhookUrl)) {
      toast.error("A URL de webhook deve ser http ou https.");
      return;
    }

    mutation.mutate(requestBody, {
      onSuccess: () => {
        toast.success("Monitor criado com sucesso.");
        setName("");
        setUrl("");
        onCreated();
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao criar monitor."),
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Novo monitor</CardTitle>
          <CardDescription>Executa capturas agendadas e detecta mudanças na página.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="monitor-name">Nome</Label>
              <Input id="monitor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Monitoramento do site" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monitor-url">URL</Label>
              <Input id="monitor-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemplo.com" aria-invalid={!!urlError} />
              {urlError && <p className="text-xs text-error">{urlError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monitor-interval">Intervalo</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger id="monitor-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {preset === "custom" && (
                <Input
                  className="mt-2 font-mono"
                  value={customInterval}
                  onChange={(e) => setCustomInterval(e.target.value)}
                  placeholder="*/15 * * * *"
                />
              )}
              <p className="text-xs text-text-secondary">O cron é interpretado em UTC (não no fuso local).</p>
            </div>

            <FormatSelector value={formats} onChange={setFormats} />

            <div className="space-y-1.5">
              <Label htmlFor="monitor-webhook">Webhook URL (opcional)</Label>
              <Input
                id="monitor-webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://meusite.com/webhooks/monitoramento"
              />
            </div>

            <FetchConfigAccordion value={fetchConfig} onChange={setFetchConfig} idPrefix="monitor" />

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Criando…" : <><Play className="h-4 w-4" /> Criar monitor</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização da requisição</CardTitle>
          <CardDescription>Confira antes de criar o monitor.</CardDescription>
        </CardHeader>
        <CardContent>
          <RequestPreview method="POST" internalEndpoint="/api/triad3/monitoramentos" body={requestBody} />
        </CardContent>
      </Card>
    </div>
  );
}

function ManageMonitorsTab() {
  const { data, isLoading, isError, error, refetch, isFetching } = useMonitorList();
  const monitors = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Meus monitores</CardTitle>
          <CardDescription>{monitors.length} monitor(es) encontrados.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingView />
        ) : isError ? (
          <ErrorView error={error} />
        ) : monitors.length === 0 ? (
          <EmptyState message="Nenhum monitor criado ainda." />
        ) : (
          <ul className="divide-y divide-border">
            {monitors.map((monitor) => (
              <MonitorRow key={monitor.cronId} monitor={monitor} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MonitorRow({ monitor }: { monitor: MonitorResponse }) {
  const id = monitor.cronId ?? "";
  const pauseMutation = usePauseMonitorMutation(id);
  const resumeMutation = useResumeMonitorMutation(id);
  const deleteMutation = useDeleteMonitorMutation(id);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-text-primary">{monitor.name ?? monitor.cronId}</p>
          <Badge variant={toneForStatus(monitor.status)}>{translateStatus(monitor.status)}</Badge>
        </div>
        <p className="truncate text-xs text-text-secondary">{monitor.url}</p>
        <p className="font-mono text-xs text-text-secondary">{monitor.interval}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/monitor/${id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Ver atividade <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        {monitor.status === "active" ? (
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
                    onSuccess: () => toast.success("Monitor excluído."),
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
    </li>
  );
}
