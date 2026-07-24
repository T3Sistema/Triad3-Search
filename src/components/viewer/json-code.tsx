"use client";

import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

SyntaxHighlighter.registerLanguage("json", json);

export function JsonCode({ data }: { data: unknown }) {
  const text = safeStringify(data);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <SyntaxHighlighter
        language="json"
        style={oneLight}
        customStyle={{ margin: 0, fontSize: "0.75rem", padding: "0.75rem", maxHeight: "480px" }}
        wrapLongLines
      >
        {text}
      </SyntaxHighlighter>
    </div>
  );
}

function safeStringify(data: unknown): string {
  if (data === undefined) return "null";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
