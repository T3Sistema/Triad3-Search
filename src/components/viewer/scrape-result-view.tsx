"use client";

import { MarkdownView } from "@/components/viewer/markdown-view";
import { HtmlSource } from "@/components/viewer/html-source";
import { LinksList } from "@/components/viewer/links-list";
import { ImagesGrid } from "@/components/viewer/images-grid";
import { ScreenshotView } from "@/components/viewer/screenshot-view";
import { JsonTree } from "@/components/viewer/json-tree";
import { EmptyState } from "@/components/viewer/empty-state";
import { asScreenshotUrl, asStringArray, asText } from "@/lib/integration/render-helpers";
import type { FormatResult, ScrapeResults } from "@/server/integrations/web-intelligence/types";

const SECTION_LABELS: Record<string, string> = {
  markdown: "Markdown",
  html: "HTML",
  links: "Links",
  images: "Imagens",
  summary: "Resumo",
  branding: "Branding",
  json: "JSON estruturado",
  screenshot: "Screenshot",
};

export function ScrapeResultView({ results }: { results?: ScrapeResults }) {
  if (!results || Object.keys(results).length === 0) {
    return <EmptyState message="Nenhum formato retornou dados para esta requisição." />;
  }

  const sections = (Object.entries(results) as [string, FormatResult | undefined][]).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (sections.length === 0) {
    return <EmptyState message="Nenhum formato retornou dados para esta requisição." />;
  }

  return (
    <div className="space-y-5">
      {sections.map(([type, formatResult]) => (
        <section key={type} className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{SECTION_LABELS[type] ?? type}</h3>
          <FormatSection type={type} data={formatResult?.data} />
        </section>
      ))}
    </div>
  );
}

function FormatSection({ type, data }: { type: string; data: unknown }) {
  switch (type) {
    case "markdown":
      return <MarkdownView content={asText(data)} />;
    case "html":
      return <HtmlSource html={asText(data)} />;
    case "links":
      return <LinksList links={asStringArray(data)} />;
    case "images":
      return <ImagesGrid images={asStringArray(data)} />;
    case "screenshot":
      return <ScreenshotView url={asScreenshotUrl(data)} />;
    case "summary":
      return <p className="whitespace-pre-wrap text-sm text-text-primary">{asText(data)}</p>;
    case "branding":
      return <BrandingCards data={data} />;
    case "json":
      return <JsonTree data={data} />;
    default:
      return <JsonTree data={data} />;
  }
}

function BrandingCards({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-text-secondary">Nenhuma informação de marca encontrada.</p>;
  }
  const entries = Object.entries(data as Record<string, unknown>);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-border bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{key}</p>
          <p className="mt-1 break-words text-sm text-text-primary">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </p>
        </div>
      ))}
    </div>
  );
}
