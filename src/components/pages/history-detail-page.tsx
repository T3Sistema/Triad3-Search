"use client";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonTree } from "@/components/viewer/json-tree";
import { ErrorView } from "@/components/viewer/error-view";
import { LoadingView } from "@/components/viewer/loading-view";
import { EmptyState } from "@/components/viewer/empty-state";
import { useHistoryDetail } from "@/hooks/use-history";
import { copyToClipboard, downloadJson } from "@/lib/download";
import { formatDateTime, formatMilliseconds } from "@/lib/ui/formatting";
import { toneForStatus, translateService, translateStatus } from "@/lib/ui/status-labels";

export function HistoryDetailPage({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useHistoryDetail(id);

  if (isLoading) return <LoadingView />;
  if (isError) return <ErrorView error={error} />;
  if (!data) return <EmptyState message="Item de histórico não encontrado." />;

  const copy = async (value: unknown, label: string) => {
    const ok = await copyToClipboard(JSON.stringify(value, null, 2));
    toast[ok ? "success" : "error"](ok ? `${label} copiado.` : `Não foi possível copiar ${label.toLowerCase()}.`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="font-mono text-sm">{data.id}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span>{translateService(data.service)}</span>
            <Badge variant={toneForStatus(data.status)}>{translateStatus(data.status)}</Badge>
            {typeof data.elapsedMs === "number" && <span>{formatMilliseconds(data.elapsedMs)}</span>}
            {data.createdAt && <span>{formatDateTime(data.createdAt)}</span>}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => copy(data, "JSON")}>
            <Copy className="h-3.5 w-3.5" /> Copiar JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadJson(data, `historico-${data.id}.json`)}>
            <Download className="h-3.5 w-3.5" /> Baixar JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="params">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="params">Parâmetros</TabsTrigger>
            <TabsTrigger value="result">Resultado</TabsTrigger>
            <TabsTrigger value="error">Erro</TabsTrigger>
            <TabsTrigger value="metadata">Metadados</TabsTrigger>
          </TabsList>
          <TabsContent value="params">
            <JsonTree data={data.params ?? {}} />
          </TabsContent>
          <TabsContent value="result">
            {data.result ? <JsonTree data={data.result} /> : <EmptyState message="Nenhum resultado disponível." />}
          </TabsContent>
          <TabsContent value="error">
            {data.error ? <JsonTree data={data.error} /> : <p className="text-sm text-text-secondary">Sem erros registrados.</p>}
          </TabsContent>
          <TabsContent value="metadata">
            <JsonTree
              data={{
                requestParentId: data.requestParentId ?? null,
                elapsedMs: data.elapsedMs,
                createdAt: data.createdAt,
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
