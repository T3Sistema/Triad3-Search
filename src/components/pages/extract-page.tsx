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
import { JsonTree } from "@/components/viewer/json-tree";
import { JsonCode } from "@/components/viewer/json-code";
import { MetadataView } from "@/components/viewer/metadata-view";
import { ErrorView } from "@/components/viewer/error-view";
import { LoadingView } from "@/components/viewer/loading-view";
import { EmptyState } from "@/components/viewer/empty-state";
import { useExtractMutation } from "@/hooks/use-extract";
import { isHttpUrl } from "@/lib/url";
import type { MarkdownHtmlMode } from "@/lib/scrapegraph/formats";

type SourceType = "url" | "html" | "markdown";
const MAX_RAW_LENGTH = 2 * 1024 * 1024;

export function ExtractPage() {
  const [source, setSource] = React.useState<SourceType>("url");
  const [url, setUrl] = React.useState("");
  const [html, setHtml] = React.useState("");
  const [markdown, setMarkdown] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [schemaRaw, setSchemaRaw] = React.useState("");
  const [mode, setMode] = React.useState<MarkdownHtmlMode>("normal");
  const [fetchConfig, setFetchConfig] = React.useState<FetchConfigFormValue>(DEFAULT_FETCH_CONFIG_FORM);
  const [resultTab, setResultTab] = React.useState("structured");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  const mutation = useExtractMutation();

  const requestBody = React.useMemo(() => {
    const prunedFetchConfig = source === "url" ? toFetchConfigPayload(fetchConfig) : undefined;
    return {
      ...(source === "url" ? { url: url || "https://example.com" } : {}),
      ...(source === "html" ? { html } : {}),
      ...(source === "markdown" ? { markdown } : {}),
      prompt: prompt || "Extraia as informações solicitadas.",
      ...(schemaRaw.trim() ? { schema: tryParse(schemaRaw) } : {}),
      mode,
      ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
    };
  }, [source, url, html, markdown, prompt, schemaRaw, mode, fetchConfig]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    if (!prompt.trim()) {
      toast.error("O prompt é obrigatório.");
      return;
    }
    if (source === "url") {
      if (!url.trim() || !isHttpUrl(url)) {
        setUrlError("Informe uma URL pública válida (http ou https).");
        return;
      }
    }
    if (source === "html" && !html.trim()) {
      toast.error("Informe o HTML de origem.");
      return;
    }
    if (source === "markdown" && !markdown.trim()) {
      toast.error("Informe o Markdown de origem.");
      return;
    }
    const schemaParsed = schemaRaw.trim() ? tryParse(schemaRaw) : undefined;
    if (schemaRaw.trim() && schemaParsed === undefined) {
      toast.error("O schema informado não é um JSON válido.");
      return;
    }

    const prunedFetchConfig = source === "url" ? toFetchConfigPayload(fetchConfig) : undefined;
    const controller = new AbortController();
    setAbortController(controller);

    mutation.mutate(
      {
        payload: {
          ...(source === "url" ? { url } : {}),
          ...(source === "html" ? { html } : {}),
          ...(source === "markdown" ? { markdown } : {}),
          prompt,
          ...(schemaParsed ? { schema: schemaParsed } : {}),
          mode,
          ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
        },
        signal: controller.signal,
      },
      {
        onSuccess: () => setResultTab("structured"),
        onError: (error) => {
          if (error instanceof Error && error.name === "AbortError") return;
          toast.error(error instanceof Error ? error.message : "Falha ao executar a extração.");
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
          <CardTitle>Requisição — Extract</CardTitle>
          <CardDescription>Extração estruturada guiada por prompt, a partir de uma única fonte.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="extract-source">Fonte</Label>
              <Select value={source} onValueChange={(v) => setSource(v as SourceType)}>
                <SelectTrigger id="extract-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-text-secondary">Selecione exatamente uma fonte por requisição.</p>
            </div>

            {source === "url" && (
              <div className="space-y-1.5">
                <Label htmlFor="extract-url">URL pública</Label>
                <Input
                  id="extract-url"
                  placeholder="https://exemplo.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  aria-invalid={!!urlError}
                />
                {urlError && <p className="text-xs text-error">{urlError}</p>}
              </div>
            )}

            {source === "html" && (
              <div className="space-y-1.5">
                <Label htmlFor="extract-html">HTML de origem (até 2 MB)</Label>
                <Textarea
                  id="extract-html"
                  rows={8}
                  value={html}
                  onChange={(e) => setHtml(e.target.value.slice(0, MAX_RAW_LENGTH))}
                  placeholder="<html>...</html>"
                />
                <p className="text-xs text-text-secondary">{html.length.toLocaleString("pt-BR")} / {MAX_RAW_LENGTH.toLocaleString("pt-BR")} caracteres</p>
              </div>
            )}

            {source === "markdown" && (
              <div className="space-y-1.5">
                <Label htmlFor="extract-markdown">Markdown de origem (até 2 MB)</Label>
                <Textarea
                  id="extract-markdown"
                  rows={8}
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value.slice(0, MAX_RAW_LENGTH))}
                  placeholder="# Título..."
                />
                <p className="text-xs text-text-secondary">{markdown.length.toLocaleString("pt-BR")} / {MAX_RAW_LENGTH.toLocaleString("pt-BR")} caracteres</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="extract-prompt">Prompt (obrigatório)</Label>
              <Textarea
                id="extract-prompt"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Extraia o título, autor e resumo."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="extract-mode">Modo</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as MarkdownHtmlMode)}>
                <SelectTrigger id="extract-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="reader">Reader</SelectItem>
                  <SelectItem value="prune">Prune</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SchemaEditor id="extract-schema" value={schemaRaw} onChange={setSchemaRaw} promptForAi={prompt} />

            {source === "url" && <FetchConfigAccordion value={fetchConfig} onChange={setFetchConfig} idPrefix="extract" />}

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
          <CardDescription>Resultado estruturado retornado pela ScrapeGraphAI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mutation.data && (
            <ResultToolbar
              requestId={mutation.data.id}
              status="completed"
              endpoint="/api/extract"
              data={mutation.data}
              requestBody={requestBody}
              filename={`extract-${mutation.data.id ?? "resultado"}.json`}
            />
          )}

          <Tabs value={resultTab} onValueChange={setResultTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="structured">Resultado</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
              <TabsTrigger value="usage">Tokens</TabsTrigger>
              <TabsTrigger value="metadata">Metadados</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="request">Requisição</TabsTrigger>
            </TabsList>

            <TabsContent value="structured">
              {mutation.isPending ? (
                <LoadingView />
              ) : mutation.isError ? (
                <ErrorView error={mutation.error} />
              ) : mutation.data ? (
                <JsonTree data={mutation.data.json ?? {}} />
              ) : (
                <EmptyState />
              )}
            </TabsContent>

            <TabsContent value="raw">
              {mutation.data ? (
                mutation.data.raw ? (
                  <pre className="max-h-[480px] overflow-auto rounded-lg border border-border bg-white p-3 text-xs">
                    {typeof mutation.data.raw === "string" ? mutation.data.raw : JSON.stringify(mutation.data.raw, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-text-secondary">Sem conteúdo raw para esta resposta.</p>
                )
              ) : (
                <EmptyState />
              )}
            </TabsContent>

            <TabsContent value="usage">
              {mutation.data?.usage ? (
                <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-white p-4 text-sm">
                  <dt className="text-text-secondary">Tokens de prompt</dt>
                  <dd className="font-medium text-text-primary">{mutation.data.usage.promptTokens ?? "—"}</dd>
                  <dt className="text-text-secondary">Tokens de resposta</dt>
                  <dd className="font-medium text-text-primary">{mutation.data.usage.completionTokens ?? "—"}</dd>
                </dl>
              ) : (
                <EmptyState message="Nenhuma informação de uso de tokens disponível." />
              )}
            </TabsContent>

            <TabsContent value="metadata">
              {mutation.data ? <MetadataView metadata={mutation.data.metadata} /> : <EmptyState />}
            </TabsContent>

            <TabsContent value="json">{mutation.data ? <JsonCode data={mutation.data} /> : <EmptyState />}</TabsContent>

            <TabsContent value="request">
              <RequestPreview method="POST" internalEndpoint="/api/sgai/extract" externalEndpoint="/extract" body={requestBody} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function tryParse(raw: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
