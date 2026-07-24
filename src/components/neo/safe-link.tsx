"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** External link that only ever opens real http(s) URLs, always with noopener/noreferrer. */
export function SafeLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  if (!isSafeHttpUrl(href)) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline ${className ?? ""}`}
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}
