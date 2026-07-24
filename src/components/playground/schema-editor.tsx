"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Braces, Check, Eraser, FileJson2, Sparkles, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JsonTree } from "@/components/viewer/json-tree";
import { apiPost } from "@/lib/api-client";
import { formatJson, validateJson } from "@/lib/json-utils";
import { cn } from "@/lib/utils";

const EXAMPLE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
  },
};

interface SchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
  promptForAi?: string;
  label?: string;
  id?: string;
}

export function SchemaEditor({ value, onChange, promptForAi, label = "Schema (JSON Schema, opcional)", id }: SchemaEditorProps) {
  const [mode, setMode] = React.useState<"editor" | "preview">("editor");
  const validation = React.useMemo(() => validateJson(value), [value]);

  const aiGeneration = useMutation({
    mutationFn: () =>
      apiPost<{ schema?: unknown } & Record<string, unknown>>("/api/triad3/schema", {
        prompt: promptForAi || "Gere um schema apropriado para os dados solicitados.",
        existing_schema: validation.valid ? validation.value : undefined,
      }),
  });

  const generatedSchema = aiGeneration.data?.schema ?? aiGeneration.data;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(formatJson(value))}>
            <Braces className="h-3.5 w-3.5" /> Formatar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
            <Eraser className="h-3.5 w-3.5" /> Limpar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(JSON.stringify(EXAMPLE_SCHEMA, null, 2))}>
            <FileJson2 className="h-3.5 w-3.5" /> Inserir exemplo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode((m) => (m === "editor" ? "preview" : "editor"))}
          >
            <Code2 className="h-3.5 w-3.5" /> {mode === "editor" ? "Visualizar" : "Editar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => aiGeneration.mutate()}
            disabled={aiGeneration.isPending}
          >
            <Sparkles className="h-3.5 w-3.5" /> Gerar schema com IA
          </Button>
        </div>
      </div>

      {mode === "editor" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={JSON.stringify(EXAMPLE_SCHEMA, null, 2)}
          rows={8}
          aria-invalid={!validation.valid}
        />
      ) : (
        <div className="min-h-[10rem]">
          {validation.valid && validation.value !== undefined ? (
            <JsonTree data={validation.value} />
          ) : (
            <p className="rounded-lg border border-border bg-white p-3 text-sm text-text-secondary">
              Nada para visualizar ainda.
            </p>
          )}
        </div>
      )}

      {!validation.valid && (
        <p className="text-xs text-error">
          JSON inválido{validation.line ? ` na linha ${validation.line}` : ""}: {validation.message}
        </p>
      )}
      {validation.valid && value.trim() && (
        <p className="flex items-center gap-1 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> JSON válido
        </p>
      )}

      {aiGeneration.isError && (
        <p className="text-xs text-text-secondary">
          Gerador automático de schema indisponível nesta versão. Continue editando o schema manualmente.
        </p>
      )}
      {aiGeneration.isSuccess && generatedSchema !== undefined && (
        <div className={cn("space-y-1 rounded-lg border border-primary/30 bg-primary-bg p-2")}>
          <p className="text-xs font-medium text-primary">Schema gerado pela IA — clique para usar:</p>
          <button
            type="button"
            className="w-full rounded-md bg-white/70 p-2 text-left text-xs hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onChange(JSON.stringify(generatedSchema, null, 2))}
          >
            {JSON.stringify(generatedSchema, null, 2)}
          </button>
        </div>
      )}
    </div>
  );
}
