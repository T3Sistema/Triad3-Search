"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";

function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Renders an image only when the URL is a real http(s) URL returned by a
 * tool — never an arbitrary string turned into an <img> automatically.
 * Falls back to a neutral placeholder on load failure or invalid URL.
 */
export function SafeImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = React.useState(!isSafeImageUrl(src));

  if (failed) {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-slate-50 p-6 text-xs text-text-secondary ${className ?? ""}`}>
        <ImageOff className="h-4 w-4" aria-hidden="true" />
        Imagem indisponível
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external, unregistered domains from investigation results; Next/Image would require per-domain config we can't predict.
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`max-w-full rounded-md border border-border object-contain ${className ?? ""}`}
      onError={() => setFailed(true)}
    />
  );
}
