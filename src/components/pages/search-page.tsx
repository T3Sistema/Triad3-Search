"use client";

import * as React from "react";
import { toast } from "sonner";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaEditor } from "@/components/playground/schema-editor";
import {
  DEFAULT_FETCH_CONFIG_FORM,
  FetchConfigAccordion,
  toFetchConfigPayload,
  type FetchConfigFormValue,
} from "@/components/playground/fetch-config";
import { RequestPreview } from "@/components/playground/request-preview";
import { ResultToolbar } from "@/components/playground/result-toolbar";
import { SearchResultsView } from "@/components/viewer/search-results-view";
import { JsonTree } from "@/components/viewer/json-tree";
import { JsonCode } from "@/components/viewer/json-code";
import { MetadataView } from "@/components/viewer/metadata-view";
import { ErrorView } from "@/components/viewer/error-view";
import { LoadingView } from "@/components/viewer/loading-view";
import { EmptyState } from "@/components/viewer/empty-state";
import { useSearchMutation } from "@/hooks/use-search";
import { SEARCH_TIME_RANGES } from "@/lib/scrapegraph/schemas";

const TIME_RANGE_LABELS: Record<string, string> = {
  none: "Sem filtro",
  past_hour: "Última hora",
  past_24_hours: "Últimas 24 horas",
  past_week: "Última semana",
  past_month: "Último mês",
  past_year: "Último ano",
};

export function SearchPage() {
  const [query, setQuery] = React.useState("");
  const [numResults, setNumResults] = React.useState(5);
  const [format, setFormat] = React.useState<"markdown" | "html">("markdown");
  const [timeRange, setTimeRange] = React.useState<string>("none");
  const [locationGeoCode, setLocationGeoCode] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [schemaRaw, setSchemaRaw] = React.useState("");
  const [fetchConfig, setFetchConfig] = React.useState<FetchConfigFormValue>(DEFAULT_FETCH_CONFIG_FORM);
  const [resultTab, setResultTab] = React.useState("results");
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  const mutation = useSearchMutation();

  const requestBody = React.useMemo(() => {
    const prunedFetchConfig = toFetchConfigPayload(fetchConfig);
    return {
      query: query || "termo de busca",
      numResults,
      format,
      ...(timeRange !== "none" ? { timeRange } : {}),
      ...(locationGeoCode ? { locationGeoCode } : {}),
      ...(prompt ? { prompt } : {}),
      ...(prompt && schemaRaw.trim() ? { schema: tryParse(schemaRaw) } : {}),
      ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
    };
  }, [query, numResults, format, timeRange, locationGeoCode, prompt, schemaRaw, fetchConfig]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast.error("Informe o termo de busca.");
      return;
    }
    const schemaParsed = prompt && schemaRaw.trim() ? tryParse(schemaRaw) : undefined;
    if (prompt && schemaRaw.trim() && schemaParsed === undefined) {
      toast.error("O schema informado não é um JSON válido.");
      return;
    }

    const prunedFetchConfig = toFetchConfigPayload(fetchConfig);
    const controller = new AbortController();
    setAbortController(controller);

    mutation.mutate(
      {
        payload: {
          query,
          numResults,
          format,
          ...(timeRange !== "none" ? { timeRange } : {}),
          ...(locationGeoCode ? { locationGeoCode } : {}),
          ...(prompt ? { prompt } : {}),
          ...(schemaParsed ? { schema: schemaParsed } : {}),
          ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
        },
        signal: controller.signal,
      },
      {
        onSuccess: () => setResultTab("results"),
        onError: (error) => {
          if (error instanceof Error && error.name === "AbortError") return;
          toast.error(error instanceof Error ? error.message : "Falha ao executar a busca.");
        },
      },
    );
  };

  const cancel = () => {
    abortController?.abort();
    toast.info("Requisição cancelada.");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Requisição — Search</CardTitle>
          <CardDescription>Busca na web com resultados processados pela ScrapeGraphAI.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="search-query">Termo de busca</Label>
              <Input
                id="search-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="inteligência artificial no Brasil"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-num-results">Número de resultados</Label>
                <Input
                  id="search-num-results"
                  type="number"
                  min={1}
                  max={20}
                  value={numResults}
                  onChange={(e) => setNumResults(clamp(Number(e.target.value), 1, 20))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-format">Formato</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as "markdown" | "html")}>
                  <SelectTrigger id="search-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-time-range">Período</Label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger id="search-time-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem filtro</SelectItem>
                    {SEARCH_TIME_RANGES.map((range) => (
                      <SelectItem key={range} value={range}>
                        {TIME_RANGE_LABELS[range]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-country">País (opcional)</Label>
                <Input
                  id="search-country"
                  value={locationGeoCode}
                  onChange={(e) => setLocationGeoCode(e.target.value.slice(0, 2))}
                  placeholder="br"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="search-prompt">Prompt (opcional — habilita análise estruturada)</Label>
              <Textarea
                id="search-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Organize os resultados encontrados por nome, site e área de atuação."
              />
            </div>

            {prompt.trim() && (
              <SchemaEditor id="search-schema" value={schemaRaw} onChange={setSchemaRaw} promptForAi={prompt} />
            )}

            <FetchConfigAccordion value={fetchConfig} onChange={setFetchConfig} idPrefix="search" />

            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending} className="flex-1">
                {mutation.isPending ? "Processando…" : <><Play className="h-4 w-4" /> Executar</>}
              </Button>
              {mutation.isPending && (
                <Button type="button" variant="outline" onClick={cancel}>
                  <X className="h-4 w-4" /> Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resposta</CardTitle>
          <CardDescription>Resultados da busca processados pela ScrapeGraphAI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mutation.data && (
            <ResultToolbar
              requestId={mutation.data.id}
              status="completed"
              endpoint="/api/search"
              data={mutation.data}
              requestBody={requestBody}
              filename={`search-${mutation.data.id ?? "resultado"}.json`}
            />
          )}

          {mutation.data?.metadata?.pages && (
            <p className="text-xs text-text-secondary">
              Solicitados: {mutation.data.metadata.pages.requested ?? "—"} · Processados: {mutation.data.metadata.pages.scraped ?? "—"}
            </p>
          )}

          <Tabs value={resultTab} onValueChange={setResultTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="results">Resultados</TabsTrigger>
              <TabsTrigger value="structured">Estruturado</TabsTrigger>
              <TabsTrigger value="metadata">Metadados</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="request">Requisição</TabsTrigger>
            </TabsList>

            <TabsContent value="results">
              {mutation.isPending ? (
                <LoadingView />
              ) : mutation.isError ? (
                <ErrorView error={mutation.error} />
              ) : mutation.data ? (
                <SearchResultsView results={mutation.data.results ?? []} />
              ) : (
                <EmptyState />
              )}
            </TabsContent>

            <TabsContent value="structured">
              {mutation.data?.json ? (
                <div className="space-y-3">
                  <JsonTree data={mutation.data.json} />
                  {mutation.data.usage && (
                    <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-white p-3 text-sm">
                      <dt className="text-text-secondary">Tokens de prompt</dt>
                      <dd>{mutation.data.usage.promptTokens ?? "—"}</dd>
                      <dt className="text-text-secondary">Tokens de resposta</dt>
                      <dd>{mutation.data.usage.completionTokens ?? "—"}</dd>
                    </dl>
                  )}
                </div>
              ) : (
                <EmptyState message="Nenhum resultado estruturado. Informe um prompt para habilitar essa análise." />
              )}
            </TabsContent>

            <TabsContent value="metadata">
              {mutation.data ? <MetadataView metadata={mutation.data.metadata} /> : <EmptyState />}
            </TabsContent>

            <TabsContent value="json">{mutation.data ? <JsonCode data={mutation.data} /> : <EmptyState />}</TabsContent>

            <TabsContent value="request">
              <RequestPreview method="POST" internalEndpoint="/api/sgai/search" externalEndpoint="/search" body={requestBody} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function tryParse(raw: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
