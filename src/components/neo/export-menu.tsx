"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFromUrl, copyToClipboard } from "@/lib/download";
import type { NeoAnswer } from "@/lib/neo/answer";

export function ExportMenu({ mensagemId, answer }: { mensagemId: string; answer: NeoAnswer }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const tabelas = answer.blocos.filter((b) => b.tipo === "tabela");

  async function baixarPdf() {
    setBusy("pdf");
    try {
      await downloadFromUrl(`/api/triad3/neo/mensagens/${mensagemId}/exportar/pdf`, `neo-relatorio-${mensagemId}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  async function baixarMarkdown() {
    setBusy("markdown");
    try {
      await downloadFromUrl(`/api/triad3/neo/mensagens/${mensagemId}/exportar/markdown`, `neo-relatorio-${mensagemId}.md`);
    } finally {
      setBusy(null);
    }
  }

  async function baixarCsv(indice: number) {
    setBusy(`csv-${indice}`);
    try {
      await downloadFromUrl(`/api/triad3/neo/mensagens/${mensagemId}/tabelas/${indice}/csv`, `neo-tabela-${indice + 1}.csv`);
    } finally {
      setBusy(null);
    }
  }

  async function copiarResumo() {
    const ok = await copyToClipboard(answer.resumoExecutivo);
    toast[ok ? "success" : "error"](ok ? "Resumo copiado." : "Não foi possível copiar o resumo.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={baixarPdf} disabled={busy === "pdf"}>
        <FileType className="h-4 w-4" /> Baixar PDF
      </Button>
      <Button variant="secondary" size="sm" onClick={baixarMarkdown} disabled={busy === "markdown"}>
        <FileText className="h-4 w-4" /> Baixar Markdown
      </Button>
      <Button variant="secondary" size="sm" onClick={copiarResumo}>
        <Copy className="h-4 w-4" /> Copiar resumo
      </Button>
      {tabelas.map((_, i) => (
        <Button key={i} variant="secondary" size="sm" onClick={() => baixarCsv(i)} disabled={busy === `csv-${i}`}>
          <FileSpreadsheet className="h-4 w-4" /> CSV — tabela {i + 1}
        </Button>
      ))}
    </div>
  );
}
