"use client";

import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

const triad3Styles = {
  ...defaultStyles,
  container: "text-xs font-mono bg-transparent",
  label: "text-primary font-semibold",
  stringValue: "text-success",
  numberValue: "text-warning",
  booleanValue: "text-primary",
  nullValue: "text-text-secondary",
  otherValue: "text-text-primary",
  punctuation: "text-text-secondary",
  collapseIcon: "text-text-secondary",
  expandIcon: "text-text-secondary",
  collapsedContent: "text-text-secondary",
};

export function JsonTree({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return <p className="p-3 text-sm text-text-secondary">Sem dados para exibir.</p>;
  }
  const safeData = typeof data === "object" ? data : { value: data };
  return (
    <div className="overflow-auto rounded-lg border border-border bg-white p-3">
      <JsonView data={safeData as object} style={triad3Styles} />
    </div>
  );
}
