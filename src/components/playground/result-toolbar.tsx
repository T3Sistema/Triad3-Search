"use client";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildCurlPreview } from "@/lib/curl";
import { copyToClipboard, downloadJson } from "@/lib/download";

interface ResultToolbarProps {
  requestId?: string;
  status?: string | number;
  elapsedMs?: number;
  endpoint: string;
  createdAt?: string;
  data: unknown;
  requestBody: unknown;
  filename: string;
}

export function ResultToolbar({ requestId, status, elapsedMs, endpoint, createdAt, data, requestBody, filename }: ResultToolbarProps) {
  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast[ok ? "success" : "error"](ok ? `${label} copiado.` : `Não foi possível copiar ${label.toLowerCase()}.`);
  };

  const timestamp = createdAt ? new Date(createdAt) : new Date();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        {requestId && (
          <span>
            ID: <span className="font-mono text-text-primary">{requestId}</span>
          </span>
        )}
        {status !== undefined && (
          <span className="inline-flex items-center gap-1">
            Status: <Badge variant={String(status).match(/^(2|running|completed|active)/i) ? "success" : "neutral"}>{status}</Badge>
          </span>
        )}
        {typeof elapsedMs === "number" && <span>Tempo: {elapsedMs.toLocaleString("pt-BR")} ms</span>}
        <span>Endpoint: <span className="font-mono text-text-primary">{endpoint}</span></span>
        <span>{timestamp.toLocaleString("pt-BR")}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => copy(JSON.stringify(data, null, 2), "JSON")}>
          <Copy className="h-3.5 w-3.5" /> Copiar JSON
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => copy(JSON.stringify(requestBody, null, 2), "Requisição")}>
          <Copy className="h-3.5 w-3.5" /> Copiar requisição
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copy(buildCurlPreview(endpoint, requestBody), "cURL")}
        >
          <Copy className="h-3.5 w-3.5" /> Copiar cURL
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadJson(data, filename)}>
          <Download className="h-3.5 w-3.5" /> Baixar resultado
        </Button>
      </div>
    </div>
  );
}
