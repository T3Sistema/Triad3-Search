import { z } from "zod";
import { fetchConfigSchema, formatSchema } from "./formats";
import { isHttpUrl } from "../url";

const httpUrlSchema = z
  .string()
  .min(1, "Informe uma URL.")
  .refine(isHttpUrl, "Informe uma URL pública válida (http ou https).");

const jsonObjectSchema = z.record(z.string(), z.unknown());

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------
export const scrapeRequestSchema = z.object({
  url: httpUrlSchema,
  contentType: z.string().max(200).optional(),
  formats: z.array(formatSchema).min(1, "Selecione ao menos um formato."),
  fetchConfig: fetchConfigSchema.optional(),
});
export type ScrapeRequest = z.infer<typeof scrapeRequestSchema>;

// ---------------------------------------------------------------------------
// Extract
// ---------------------------------------------------------------------------
export const extractRequestSchema = z
  .object({
    url: httpUrlSchema.optional(),
    html: z.string().max(2 * 1024 * 1024, "O HTML excede o limite de 2 MB.").optional(),
    markdown: z.string().max(2 * 1024 * 1024, "O Markdown excede o limite de 2 MB.").optional(),
    prompt: z.string().min(1, "O prompt é obrigatório."),
    schema: jsonObjectSchema.optional(),
    mode: z.enum(["normal", "reader", "prune"]).optional(),
    fetchConfig: fetchConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const sources = [data.url, data.html, data.markdown].filter((v) => v !== undefined && v !== "");
    if (sources.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Selecione exatamente uma fonte: URL, HTML ou Markdown.",
        path: ["url"],
      });
    }
    if (sources.length > 1) {
      ctx.addIssue({
        code: "custom",
        message: "Envie apenas uma fonte por vez: URL, HTML ou Markdown.",
        path: ["url"],
      });
    }
    if (data.fetchConfig && !data.url) {
      ctx.addIssue({
        code: "custom",
        message: "As configurações de captura só se aplicam quando a fonte é uma URL.",
        path: ["fetchConfig"],
      });
    }
  });
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export const SEARCH_TIME_RANGES = [
  "past_hour",
  "past_24_hours",
  "past_week",
  "past_month",
  "past_year",
] as const;

export const searchRequestSchema = z
  .object({
    query: z.string().min(1, "Informe o termo de busca."),
    numResults: z.number().int().min(1).max(20).optional(),
    format: z.enum(["markdown", "html"]).optional(),
    timeRange: z.enum(SEARCH_TIME_RANGES).optional(),
    locationGeoCode: z
      .string()
      .regex(/^[a-zA-Z]{2}$/, "Use o código de país com duas letras.")
      .transform((v) => v.toLowerCase())
      .optional(),
    prompt: z.string().optional(),
    schema: jsonObjectSchema.optional(),
    fetchConfig: fetchConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.schema && !data.prompt) {
      ctx.addIssue({
        code: "custom",
        message: "O schema só pode ser usado junto de um prompt.",
        path: ["schema"],
      });
    }
  });
export type SearchRequest = z.infer<typeof searchRequestSchema>;

// ---------------------------------------------------------------------------
// Crawl
// ---------------------------------------------------------------------------
export const crawlRequestSchema = z.object({
  url: httpUrlSchema,
  formats: z.array(formatSchema).min(1, "Selecione ao menos um formato."),
  maxPages: z.number().int().min(1).max(1000).default(50),
  maxDepth: z.number().int().min(0).max(50).default(2),
  maxLinksPerPage: z.number().int().min(0).max(200).default(10),
  includePatterns: z.array(z.string().min(1)).optional(),
  excludePatterns: z.array(z.string().min(1)).optional(),
  allowExternal: z.boolean().default(false),
  contentTypes: z.array(z.string().min(1)).optional(),
  fetchConfig: fetchConfigSchema.optional(),
});
export type CrawlRequest = z.infer<typeof crawlRequestSchema>;

export const crawlPagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Monitor
// ---------------------------------------------------------------------------
const CRON_FIELD = "[0-9*,\\-/]+";
const CRON_REGEX = new RegExp(`^${CRON_FIELD}(\\s+${CRON_FIELD}){4}$`);

export const cronSchema = z
  .string()
  .min(1, "Informe o intervalo em formato cron.")
  .regex(CRON_REGEX, "Use um cron de 5 campos separados por espaço (minuto hora dia mês dia-da-semana), em UTC.");

export const monitorCreateRequestSchema = z.object({
  name: z.string().min(1, "Informe um nome para o monitor.").max(200),
  url: httpUrlSchema,
  interval: cronSchema,
  formats: z.array(formatSchema).min(1, "Selecione ao menos um formato."),
  webhookUrl: httpUrlSchema.optional(),
  fetchConfig: fetchConfigSchema.optional(),
});
export type MonitorCreateRequest = z.infer<typeof monitorCreateRequestSchema>;

export const monitorPatchRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: httpUrlSchema.optional(),
  interval: cronSchema.optional(),
  formats: z.array(formatSchema).min(1).optional(),
  webhookUrl: httpUrlSchema.nullable().optional(),
  fetchConfig: fetchConfigSchema.optional(),
});
export type MonitorPatchRequest = z.infer<typeof monitorPatchRequestSchema>;

export const monitorActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const monitorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export const HISTORY_SERVICES = ["scrape", "extract", "search", "monitor", "crawl", "schema"] as const;

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  service: z.enum(HISTORY_SERVICES).optional(),
  status: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Schema generator (optional endpoint)
// ---------------------------------------------------------------------------
export const schemaGenRequestSchema = z.object({
  prompt: z.string().min(1, "Descreva o que deseja extrair."),
  existing_schema: jsonObjectSchema.optional(),
  model: z.string().nullable().optional(),
});
export type SchemaGenRequest = z.infer<typeof schemaGenRequestSchema>;
