"use client";

import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SchemaEditor } from "@/components/playground/schema-editor";
import {
  FORMAT_TYPES,
  MARKDOWN_HTML_MODES,
  type FormatType,
  type MarkdownHtmlMode,
  type ScrapeFormat,
} from "@/lib/integration/formats";
import { cn } from "@/lib/utils";

const FORMAT_LABELS: Record<FormatType, string> = {
  markdown: "Markdown",
  html: "HTML",
  links: "Links",
  images: "Imagens",
  summary: "Resumo",
  branding: "Branding",
  json: "JSON estruturado",
  screenshot: "Screenshot",
};

const FORMAT_DESCRIPTIONS: Record<FormatType, string> = {
  markdown: "Conteúdo convertido em Markdown.",
  html: "HTML bruto da página.",
  links: "Lista de links encontrados.",
  images: "Lista de imagens encontradas.",
  summary: "Resumo textual gerado pela IA.",
  branding: "Elementos de marca (nome, logo, cores).",
  json: "Extração estruturada guiada por prompt.",
  screenshot: "Captura de tela da página.",
};

interface FormatSelectorProps {
  value: ScrapeFormat[];
  onChange: (value: ScrapeFormat[]) => void;
  availableTypes?: FormatType[];
}

export function FormatSelector({ value, onChange, availableTypes = FORMAT_TYPES }: FormatSelectorProps) {
  const getFormat = (type: FormatType) => value.find((f) => f.type === type);

  const toggle = (type: FormatType, enabled: boolean) => {
    if (enabled) {
      onChange([...value, defaultFormatFor(type)]);
    } else {
      onChange(value.filter((f) => f.type !== type));
    }
  };

  const update = (type: FormatType, patch: Record<string, unknown>) => {
    onChange(value.map((f) => (f.type === type ? ({ ...f, ...patch } as ScrapeFormat) : f)));
  };

  return (
    <div className="space-y-2">
      <Label>Formatos</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {availableTypes.map((type) => {
          const format = getFormat(type);
          const enabled = Boolean(format);
          return (
            <div
              key={type}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                enabled ? "border-primary bg-primary-bg/40" : "border-border bg-white",
              )}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  id={`format-${type}`}
                  checked={enabled}
                  onCheckedChange={(checked) => toggle(type, checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor={`format-${type}`} className="cursor-pointer">
                    {FORMAT_LABELS[type]}
                  </Label>
                  <p className="text-xs text-text-secondary">{FORMAT_DESCRIPTIONS[type]}</p>
                </div>
              </div>

              {enabled && format && (format.type === "markdown" || format.type === "html") && (
                <div className="mt-3 space-y-1.5 pl-7">
                  <Label htmlFor={`format-${type}-mode`} className="text-xs">
                    Modo
                  </Label>
                  <Select
                    value={format.mode ?? "normal"}
                    onValueChange={(mode) => update(type, { mode: mode as MarkdownHtmlMode })}
                  >
                    <SelectTrigger id={`format-${type}-mode`} className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKDOWN_HTML_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {MODE_LABELS[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {enabled && format?.type === "json" && (
                <div className="mt-3 space-y-3 pl-7">
                  <div className="space-y-1.5">
                    <Label htmlFor="format-json-prompt" className="text-xs">
                      Prompt (obrigatório)
                    </Label>
                    <Textarea
                      id="format-json-prompt"
                      rows={2}
                      value={format.prompt}
                      onChange={(e) => update(type, { prompt: e.target.value })}
                      placeholder="Extraia as informações solicitadas."
                    />
                  </div>
                  <SchemaEditor
                    id="format-json-schema"
                    label="Schema (opcional)"
                    value={format.schema ? JSON.stringify(format.schema, null, 2) : ""}
                    promptForAi={format.prompt}
                    onChange={(raw) => {
                      try {
                        update(type, { schema: raw.trim() ? JSON.parse(raw) : undefined });
                      } catch {
                        // Keep last valid schema until the JSON becomes valid again.
                      }
                    }}
                  />
                </div>
              )}

              {enabled && format?.type === "screenshot" && (
                <div className="mt-3 space-y-2 pl-7">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="format-screenshot-fullpage" className="text-xs">
                      Página inteira
                    </Label>
                    <Switch
                      id="format-screenshot-fullpage"
                      checked={format.fullPage ?? false}
                      onCheckedChange={(fullPage) => update(type, { fullPage })}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Largura</Label>
                      <Input
                        type="number"
                        value={format.width ?? 1440}
                        onChange={(e) => update(type, { width: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Altura</Label>
                      <Input
                        type="number"
                        value={format.height ?? 900}
                        onChange={(e) => update(type, { height: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qualidade</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={format.quality ?? 90}
                        onChange={(e) => update(type, { quality: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <p>URLs de screenshots podem ser temporárias e expirar. Baixe assim que disponível.</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MODE_LABELS: Record<MarkdownHtmlMode, string> = {
  normal: "Normal",
  reader: "Modo leitura",
  prune: "Modo reduzido",
};

function defaultFormatFor(type: FormatType): ScrapeFormat {
  switch (type) {
    case "markdown":
      return { type: "markdown", mode: "normal" };
    case "html":
      return { type: "html", mode: "normal" };
    case "links":
      return { type: "links" };
    case "images":
      return { type: "images" };
    case "summary":
      return { type: "summary" };
    case "branding":
      return { type: "branding" };
    case "json":
      return { type: "json", prompt: "" };
    case "screenshot":
      return { type: "screenshot", fullPage: true, width: 1440, height: 900, quality: 90 };
  }
}
