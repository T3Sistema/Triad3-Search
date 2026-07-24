"use client";

import * as React from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

SyntaxHighlighter.registerLanguage("markup", markup);

/**
 * Renders raw HTML returned by the API. The preview tab uses a fully
 * sandboxed iframe (no scripts, no same-origin) — the extracted markup is
 * never executed directly in the app.
 */
export function HtmlSource({ html }: { html: string }) {
  const [tab, setTab] = React.useState("code");

  if (!html) {
    return <p className="text-sm text-text-secondary">Sem conteúdo HTML.</p>;
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="code">Código</TabsTrigger>
        <TabsTrigger value="preview">Preview (sandbox)</TabsTrigger>
      </TabsList>
      <TabsContent value="code">
        <div className="overflow-hidden rounded-lg border border-border">
          <SyntaxHighlighter
            language="markup"
            style={oneLight}
            customStyle={{ margin: 0, fontSize: "0.75rem", padding: "0.75rem", maxHeight: "480px" }}
            wrapLongLines
          >
            {html}
          </SyntaxHighlighter>
        </div>
      </TabsContent>
      <TabsContent value="preview">
        <p className="mb-2 text-xs text-text-secondary">
          Pré-visualização em iframe isolado. Scripts do conteúdo capturado nunca são executados.
        </p>
        <iframe
          title="Preview do HTML capturado"
          sandbox=""
          srcDoc={html}
          className="h-[480px] w-full rounded-lg border border-border bg-white"
        />
      </TabsContent>
    </Tabs>
  );
}
