"use client";

import { JsonTree } from "@/components/viewer/json-tree";

export function MetadataView({ metadata }: { metadata: unknown }) {
  if (!metadata || (typeof metadata === "object" && Object.keys(metadata).length === 0)) {
    return <p className="text-sm text-text-secondary">Nenhum metadado disponível para esta resposta.</p>;
  }
  return <JsonTree data={metadata} />;
}
