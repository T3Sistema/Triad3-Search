"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormatSelector } from "@/components/playground/format-selector";
import {
  DEFAULT_FETCH_CONFIG_FORM,
  FetchConfigAccordion,
  toFetchConfigPayload,
  type FetchConfigFormValue,
} from "@/components/playground/fetch-config";
import { RequestPreview } from "@/components/playground/request-preview";
import { useCreateCrawlMutation } from "@/hooks/use-crawl";
import { isHttpUrl } from "@/lib/url";
import { pushRecentItem, useRecentItemsSnapshot } from "@/lib/recent-items";
import type { ScrapeFormat } from "@/lib/integration/formats";
import Link from "next/link";

const RECENT_CRAWLS_KEY = "recent-crawls";

export function CrawlPage() {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [formats, setFormats] = React.useState<ScrapeFormat[]>([{ type: "markdown", mode: "reader" }, { type: "links" }]);
  const [maxPages, setMaxPages] = React.useState(50);
  const [maxDepth, setMaxDepth] = React.useState(2);
  const [maxLinksPerPage, setMaxLinksPerPage] = React.useState(10);
  const [includePatterns, setIncludePatterns] = React.useState("");
  const [excludePatterns, setExcludePatterns] = React.useState("");
  const [allowExternal, setAllowExternal] = React.useState(false);
  const [contentTypes, setContentTypes] = React.useState("");
  const [fetchConfig, setFetchConfig] = React.useState<FetchConfigFormValue>(DEFAULT_FETCH_CONFIG_FORM);

  const mutation = useCreateCrawlMutation();
  const recentCrawls = useRecentItemsSnapshot(RECENT_CRAWLS_KEY);

  const requestBody = React.useMemo(() => {
    const prunedFetchConfig = toFetchConfigPayload(fetchConfig);
    return {
      url: url || "https://example.com",
      formats,
      maxPages,
      maxDepth,
      maxLinksPerPage,
      ...(linesToArray(includePatterns).length ? { includePatterns: linesToArray(includePatterns) } : {}),
      ...(linesToArray(excludePatterns).length ? { excludePatterns: linesToArray(excludePatterns) } : {}),
      allowExternal,
      ...(contentTypes.trim() ? { contentTypes: commaToArray(contentTypes) } : {}),
      ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
    };
  }, [url, formats, maxPages, maxDepth, maxLinksPerPage, includePatterns, excludePatterns, allowExternal, contentTypes, fetchConfig]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    if (!url.trim() || !isHttpUrl(url)) {
      setUrlError("Informe uma URL pública válida (http ou https).");
      return;
    }
    if (formats.length === 0) {
      toast.error("Selecione ao menos um formato.");
      return;
    }

    mutation.mutate(requestBody, {
      onSuccess: (data) => {
        if (data.id) {
          pushRecentItem(RECENT_CRAWLS_KEY, { id: data.id, label: url, createdAt: new Date().toISOString() });
          toast.success("Mapeamento iniciado. Acompanhando progresso…");
          router.push(`/crawl/${data.id}`);
        }
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao iniciar o mapeamento."),
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Requisição — Mapear site</CardTitle>
          <CardDescription>Rastreia múltiplas páginas a partir de uma URL inicial.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="crawl-url">URL inicial</Label>
              <Input id="crawl-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemplo.com" aria-invalid={!!urlError} />
              {urlError && <p className="text-xs text-error">{urlError}</p>}
            </div>

            <FormatSelector value={formats} onChange={setFormats} />

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="crawl-max-pages">Máx. páginas</Label>
                <Input id="crawl-max-pages" type="number" min={1} max={1000} value={maxPages} onChange={(e) => setMaxPages(clamp(Number(e.target.value), 1, 1000))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crawl-max-depth">Profundidade máx.</Label>
                <Input id="crawl-max-depth" type="number" min={0} max={50} value={maxDepth} onChange={(e) => setMaxDepth(clamp(Number(e.target.value), 0, 50))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crawl-max-links">Links/página</Label>
                <Input id="crawl-max-links" type="number" min={0} max={200} value={maxLinksPerPage} onChange={(e) => setMaxLinksPerPage(clamp(Number(e.target.value), 0, 200))} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="crawl-include">Padrões de inclusão (um por linha)</Label>
                <Textarea id="crawl-include" rows={3} value={includePatterns} onChange={(e) => setIncludePatterns(e.target.value)} placeholder="/blog/**" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crawl-exclude">Padrões de exclusão (um por linha)</Label>
                <Textarea id="crawl-exclude" rows={3} value={excludePatterns} onChange={(e) => setExcludePatterns(e.target.value)} placeholder="/login/**" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="crawl-content-types">Tipos de conteúdo (separados por vírgula)</Label>
              <Input id="crawl-content-types" value={contentTypes} onChange={(e) => setContentTypes(e.target.value)} placeholder="text/html, application/pdf" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div>
                <Label htmlFor="crawl-allow-external">Permitir domínios externos</Label>
                <p className="text-xs text-text-secondary">Segue links para fora do domínio inicial.</p>
              </div>
              <Switch id="crawl-allow-external" checked={allowExternal} onCheckedChange={setAllowExternal} />
            </div>

            <FetchConfigAccordion value={fetchConfig} onChange={setFetchConfig} idPrefix="crawl" />

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "Iniciando…" : <><Play className="h-4 w-4" /> Iniciar mapeamento</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização da requisição</CardTitle>
            <CardDescription>Confira antes de iniciar. O acompanhamento abre em uma página dedicada.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="request">
              <TabsList>
                <TabsTrigger value="request">Requisição</TabsTrigger>
              </TabsList>
              <TabsContent value="request">
                <RequestPreview method="POST" internalEndpoint="/api/triad3/mapear" body={requestBody} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {recentCrawls.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Mapeamentos recentes</CardTitle>
              <CardDescription>Guardados apenas neste navegador.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {recentCrawls.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">{item.label}</p>
                      <p className="truncate text-xs text-text-secondary">{item.id}</p>
                    </div>
                    <Link href={`/crawl/${item.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      Ver <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function linesToArray(raw: string): string[] {
  return raw.split("\n").map((line) => line.trim()).filter(Boolean);
}

function commaToArray(raw: string): string[] {
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}
