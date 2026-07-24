"use client";

import { ExternalLink } from "lucide-react";
import { formatNumber } from "@/lib/ui/formatting";

export function LinksList({ links, count }: { links: string[]; count?: number }) {
  if (!links || links.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhum link encontrado.</p>;
  }
  return (
    <div className="space-y-2">
      {typeof count === "number" && (
        <p className="text-xs text-text-secondary">{formatNumber(count)} link(s) encontrados</p>
      )}
      <ul className="max-h-[480px] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-white">
        {links.map((link, index) => (
          <li key={`${link}-${index}`}>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{link}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
