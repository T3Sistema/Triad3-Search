/**
 * Loose response types for the ScrapeGraphAI V2 API. These describe the
 * fields the UI actively renders, but every object also accepts unknown
 * extra keys (passthrough) — the API may add fields at any time and the
 * "JSON" tab always shows the untouched original payload regardless of
 * these types.
 */

export type Passthrough = { [key: string]: unknown };

export interface FormatResult extends Passthrough {
  data?: unknown;
  metadata?: Passthrough;
}

export interface ScrapeResults extends Passthrough {
  markdown?: FormatResult;
  html?: FormatResult;
  links?: FormatResult;
  images?: FormatResult;
  summary?: FormatResult;
  branding?: FormatResult;
  json?: FormatResult;
  screenshot?: FormatResult;
}

export interface ScrapeResponse extends Passthrough {
  id?: string;
  status?: string;
  results?: ScrapeResults;
  metadata?: Passthrough;
}

export interface TokenUsage extends Passthrough {
  promptTokens?: number;
  completionTokens?: number;
}

export interface ChunkerChunk extends Passthrough {
  size?: number;
}

export interface ExtractMetadata extends Passthrough {
  chunker?: { chunks?: ChunkerChunk[] } & Passthrough;
  fetch?: Passthrough;
}

export interface ExtractResponse extends Passthrough {
  id?: string;
  raw?: unknown;
  json?: unknown;
  usage?: TokenUsage;
  metadata?: ExtractMetadata;
}

export interface SearchResultItem extends Passthrough {
  url?: string;
  title?: string;
  content?: string;
}

export interface SearchMetadata extends Passthrough {
  search?: Passthrough;
  pages?: { requested?: number; scraped?: number } & Passthrough;
}

export interface SearchResponse extends Passthrough {
  id?: string;
  results?: SearchResultItem[];
  metadata?: SearchMetadata;
  json?: unknown;
  raw?: unknown;
  usage?: TokenUsage;
}

export type CrawlStatus = "running" | "completed" | "failed" | "stopped";

export interface CrawlPageEntry extends Passthrough {
  url?: string;
  title?: string;
  depth?: number;
  status?: string;
  parentUrl?: string;
  contentType?: string;
  linksCount?: number;
  scrapeReferenceId?: string;
}

export interface CrawlStatusResponse extends Passthrough {
  id?: string;
  status?: CrawlStatus;
  total?: number;
  finished?: number;
  pages?: CrawlPageEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Pagination extends Passthrough {
  limit?: number;
  nextCursor?: string | null;
}

export interface CrawlPagesResponse extends Passthrough {
  data?: CrawlPageEntry[];
  pagination?: Pagination;
}

export type MonitorStatus = "active" | "paused" | "deleted" | string;

export interface MonitorResponse extends Passthrough {
  cronId?: string;
  scheduleId?: string;
  interval?: string;
  status?: MonitorStatus;
  config?: Passthrough;
  createdAt?: string;
  updatedAt?: string;
  name?: string;
  url?: string;
  webhookUrl?: string;
}

export interface MonitorListResponse extends Passthrough {
  data?: MonitorResponse[];
  pagination?: Pagination;
}

export interface MonitorTick extends Passthrough {
  id?: string;
  status?: string;
  createdAt?: string;
  elapsedMs?: number;
  changed?: boolean;
  diffs?: Passthrough;
}

export interface MonitorActivityResponse extends Passthrough {
  ticks?: MonitorTick[];
  nextCursor?: string | null;
}

export type HistoryService = "scrape" | "extract" | "search" | "monitor" | "crawl" | "schema";

export interface HistoryItem extends Passthrough {
  id?: string;
  userId?: string;
  service?: HistoryService | string;
  status?: string;
  params?: Passthrough;
  result?: unknown;
  error?: unknown;
  elapsedMs?: number;
  requestParentId?: string | null;
  createdAt?: string;
}

export interface HistoryListResponse extends Passthrough {
  data?: HistoryItem[];
  pagination?: { page?: number; limit?: number; total?: number } & Passthrough;
}

export interface CreditsJobUsage extends Passthrough {
  used?: number;
  limit?: number;
}

export interface CreditsResponse extends Passthrough {
  remaining?: number;
  used?: number;
  plan?: string;
  jobs?: { crawl?: CreditsJobUsage; monitor?: CreditsJobUsage } & Passthrough;
}

export interface ApiErrorBody {
  error: {
    type: string;
    message: string;
    originalMessage?: string;
    details?: unknown;
  };
}
