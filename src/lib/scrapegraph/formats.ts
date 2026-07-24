import { z } from "zod";

/**
 * Shared "format" selector used by Scrape, Crawl and Monitor.
 * Mirrors the ScrapeGraphAI V2 `formats[]` payload shape.
 */
export const MARKDOWN_HTML_MODES = ["normal", "reader", "prune"] as const;
export type MarkdownHtmlMode = (typeof MARKDOWN_HTML_MODES)[number];

const jsonSchemaObject = z.record(z.string(), z.unknown());

export const formatMarkdownSchema = z.object({
  type: z.literal("markdown"),
  mode: z.enum(MARKDOWN_HTML_MODES).optional(),
});

export const formatHtmlSchema = z.object({
  type: z.literal("html"),
  mode: z.enum(MARKDOWN_HTML_MODES).optional(),
});

export const formatLinksSchema = z.object({ type: z.literal("links") });
export const formatImagesSchema = z.object({ type: z.literal("images") });
export const formatSummarySchema = z.object({ type: z.literal("summary") });
export const formatBrandingSchema = z.object({ type: z.literal("branding") });

export const formatJsonSchema = z.object({
  type: z.literal("json"),
  prompt: z.string().min(1, "O prompt é obrigatório para o formato JSON."),
  schema: jsonSchemaObject.optional(),
});

export const formatScreenshotSchema = z.object({
  type: z.literal("screenshot"),
  fullPage: z.boolean().optional(),
  width: z.number().int().min(200).max(3840).optional(),
  height: z.number().int().min(200).max(3840).optional(),
  quality: z.number().int().min(1).max(100).optional(),
});

export const formatSchema = z.discriminatedUnion("type", [
  formatMarkdownSchema,
  formatHtmlSchema,
  formatLinksSchema,
  formatImagesSchema,
  formatSummarySchema,
  formatBrandingSchema,
  formatJsonSchema,
  formatScreenshotSchema,
]);

export type ScrapeFormat = z.infer<typeof formatSchema>;
export type FormatType = ScrapeFormat["type"];

export const FORMAT_TYPES: FormatType[] = [
  "markdown",
  "html",
  "links",
  "images",
  "summary",
  "branding",
  "json",
  "screenshot",
];

export const FETCH_MODES = ["auto", "fast", "js"] as const;
export type FetchMode = (typeof FETCH_MODES)[number];

export const fetchConfigSchema = z.object({
  mode: z.enum(FETCH_MODES).optional(),
  stealth: z.boolean().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  cookies: z.record(z.string(), z.string()).optional(),
  scrolls: z.number().int().min(0).max(100).optional(),
  wait: z.number().int().min(0).max(30000).optional(),
  timeout: z.number().int().min(1000).max(60000).optional(),
  country: z
    .string()
    .regex(/^[a-zA-Z]{2}$/, "Use o código de país com duas letras (ISO 3166-1 alpha-2).")
    .transform((v) => v.toLowerCase())
    .optional(),
});

export type FetchConfig = z.infer<typeof fetchConfigSchema>;

/** Removes empty/undefined keys so we never send noise to the provider. */
export function pruneFetchConfig(config: FetchConfig | undefined | null): FetchConfig | undefined {
  if (!config) return undefined;
  const out: FetchConfig = {};
  if (config.mode) out.mode = config.mode;
  if (config.stealth) out.stealth = config.stealth;
  if (config.headers && Object.keys(config.headers).length > 0) out.headers = config.headers;
  if (config.cookies && Object.keys(config.cookies).length > 0) out.cookies = config.cookies;
  if (typeof config.scrolls === "number" && config.scrolls > 0) out.scrolls = config.scrolls;
  if (typeof config.wait === "number" && config.wait > 0) out.wait = config.wait;
  if (typeof config.timeout === "number") out.timeout = config.timeout;
  if (config.country) out.country = config.country;
  return Object.keys(out).length > 0 ? out : undefined;
}
