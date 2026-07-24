"use client";

import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonCode } from "@/components/viewer/json-code";
import { buildCurlPreview } from "@/lib/curl";
import { copyToClipboard } from "@/lib/download";
import { toast } from "sonner";

interface RequestPreviewProps {
  method: string;
  internalEndpoint: string;
  externalEndpoint: string;
  body: unknown;
}

export function RequestPreview({ method, internalEndpoint, externalEndpoint, body }: RequestPreviewProps) {
  const curl = buildCurlPreview(externalEndpoint, body);

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast[ok ? "success" : "error"](ok ? `${label} copiado.` : `Não foi possível copiar ${label.toLowerCase()}.`);
  };

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-text-secondary">Método</dt>
        <dd>
          <Badge variant="outline">{method}</Badge>
        </dd>
        <dt className="text-text-secondary">Endpoint interno</dt>
        <dd className="font-mono text-text-primary">{internalEndpoint}</dd>
        <dt className="text-text-secondary">Endpoint ScrapeGraphAI</dt>
        <dd className="font-mono text-text-primary">{externalEndpoint}</dd>
      </dl>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-text-secondary">JSON da requisição</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => copy(JSON.stringify(body, null, 2), "JSON")}>
            <Copy className="h-3.5 w-3.5" /> Copiar JSON
          </Button>
        </div>
        <JsonCode data={body} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-text-secondary">cURL equivalente</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => copy(curl, "cURL")}>
            <Copy className="h-3.5 w-3.5" /> Copiar cURL
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border bg-text-primary p-3 text-xs text-white">
          {curl}
        </pre>
      </div>
    </div>
  );
}
