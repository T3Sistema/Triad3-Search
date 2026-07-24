"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormatSelector } from "@/components/playground/format-selector";
import { DEFAULT_FETCH_CONFIG_FORM, FetchConfigAccordion, toFetchConfigPayload, type FetchConfigFormValue } from "@/components/playground/fetch-config";
import { RequestPreview } from "@/components/playground/request-preview";
import { ResultToolbar } from "@/components/playground/result-toolbar";
import { ScrapeResultView } from "@/components/viewer/scrape-result-view";
import { JsonCode } from "@/components/viewer/json-code";
import { MetadataView } from "@/components/viewer/metadata-view";
import { ErrorView } from "@/components/viewer/error-view";
import { LoadingView } from "@/components/viewer/loading-view";
import { EmptyState } from "@/components/viewer/empty-state";
import { useScrapeMutation } from "@/hooks/use-scrape";
import { isHttpUrl } from "@/lib/url";
import type { ScrapeFormat } from "@/lib/integration/formats";

const formSchema = z.object({
  url: z.string().min(1, "Informe uma URL.").refine(isHttpUrl, "Informe uma URL pública válida (http ou https)."),
  contentType: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function ScrapePage() {
  const [formats, setFormats] = React.useState<ScrapeFormat[]>([{ type: "markdown", mode: "normal" }]);
  const [fetchConfig, setFetchConfig] = React.useState<FetchConfigFormValue>(DEFAULT_FETCH_CONFIG_FORM);
  const [resultTab, setResultTab] = React.useState("view");
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "", contentType: "" },
  });

  const mutation = useScrapeMutation();
  const watchedUrl = useWatch({ control: form.control, name: "url" });
  const watchedContentType = useWatch({ control: form.control, name: "contentType" });

  const requestBody = React.useMemo(() => {
    const prunedFetchConfig = toFetchConfigPayload(fetchConfig);
    return {
      url: watchedUrl || "https://example.com",
      ...(watchedContentType ? { contentType: watchedContentType } : {}),
      formats,
      ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
    };
  }, [watchedUrl, watchedContentType, formats, fetchConfig]);

  const onSubmit = form.handleSubmit((values) => {
    if (formats.length === 0) {
      toast.error("Selecione ao menos um formato.");
      return;
    }
    const invalidJson = formats.find((f) => f.type === "json" && !f.prompt.trim());
    if (invalidJson) {
      toast.error("O prompt é obrigatório para o formato JSON.");
      return;
    }

    const prunedFetchConfig = toFetchConfigPayload(fetchConfig);
    const controller = new AbortController();
    setAbortController(controller);

    mutation.mutate(
      {
        payload: {
          url: values.url,
          ...(values.contentType ? { contentType: values.contentType } : {}),
          formats,
          ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
        },
        signal: controller.signal,
      },
      {
        onSuccess: () => setResultTab("view"),
        onError: (error) => {
          if (error instanceof Error && error.name === "AbortError") return;
          toast.error(error instanceof Error ? error.message : "Falha ao executar a captura.");
        },
      },
    );
  });

  const cancel = () => {
    abortController?.abort();
    toast.info("Requisição cancelada.");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Requisição — Capturar</CardTitle>
          <CardDescription>Captura uma página pública em um ou mais formatos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scrape-url">URL pública</Label>
              <Input id="scrape-url" placeholder="https://exemplo.com" {...form.register("url")} aria-invalid={!!form.formState.errors.url} />
              {form.formState.errors.url && <p className="text-xs text-error">{form.formState.errors.url.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scrape-content-type">Content Type (opcional)</Label>
              <Input id="scrape-content-type" placeholder="text/html" {...form.register("contentType")} />
            </div>

            <FormatSelector value={formats} onChange={setFormats} />

            <FetchConfigAccordion value={fetchConfig} onChange={setFetchConfig} idPrefix="scrape" />

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
          <CardDescription>Resultado da requisição enviada ao serviço.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mutation.data && (
            <ResultToolbar
              requestId={mutation.data.id}
              status={mutation.data.status ?? "completed"}
              endpoint="/api/triad3/capturar"
              data={mutation.data}
              requestBody={requestBody}
              filename={`captura-${mutation.data.id ?? "resultado"}.json`}
            />
          )}

          <Tabs value={resultTab} onValueChange={setResultTab}>
            <TabsList>
              <TabsTrigger value="view">Visualização</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="metadata">Metadados</TabsTrigger>
              <TabsTrigger value="request">Requisição</TabsTrigger>
            </TabsList>

            <TabsContent value="view">
              {mutation.isPending ? (
                <LoadingView />
              ) : mutation.isError ? (
                <ErrorView error={mutation.error} />
              ) : mutation.data ? (
                <ScrapeResultView results={mutation.data.results} />
              ) : (
                <EmptyState />
              )}
            </TabsContent>

            <TabsContent value="json">
              {mutation.data ? <JsonCode data={mutation.data} /> : <EmptyState />}
            </TabsContent>

            <TabsContent value="metadata">
              {mutation.data ? <MetadataView metadata={mutation.data.metadata} /> : <EmptyState />}
            </TabsContent>

            <TabsContent value="request">
              <RequestPreview method="POST" internalEndpoint="/api/triad3/capturar" body={requestBody} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
