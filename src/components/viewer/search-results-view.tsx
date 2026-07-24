"use client";

import { ExternalLink } from "lucide-react";
import type { SearchResultItem } from "@/server/integrations/web-intelligence/types";

export function SearchResultsView({ results }: { results: SearchResultItem[] }) {
  if (!results || results.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhum resultado encontrado.</p>;
  }

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <article key={`${result.url ?? index}`} className="rounded-lg border border-border bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{result.title || "Sem título"}</h3>
          </div>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{result.url}</span>
            </a>
          )}
          {result.content && <p className="mt-2 line-clamp-4 text-sm text-text-secondary">{result.content}</p>}
        </article>
      ))}
    </div>
  );
}
