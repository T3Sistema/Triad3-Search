"use client";

import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFromUrl } from "@/lib/download";

export function ScreenshotView({ url }: { url?: string }) {
  if (!url) {
    return <p className="text-sm text-text-secondary">Nenhum screenshot disponível.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg p-3 text-xs text-warning">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>Esta URL de screenshot pode ser temporária e expirar. Baixe o arquivo agora se quiser mantê-lo.</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote, temporary provider URL */}
      <img src={url} alt="Screenshot capturado" className="max-h-[520px] w-full rounded-lg border border-border object-contain bg-slate-50" />
      <Button type="button" variant="secondary" onClick={() => downloadFromUrl(url, "screenshot.png")}>
        <Download className="h-4 w-4" />
        Baixar screenshot
      </Button>
    </div>
  );
}
