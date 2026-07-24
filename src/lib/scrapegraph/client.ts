import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeError, type NormalizedError } from "./errors";

const DEFAULT_BASE_URL = "https://v2-api.scrapegraphai.com";
const API_PREFIX = "/api";
const DEFAULT_TIMEOUT_MS = 55_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export type SgaiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type SgaiResult<T = unknown> =
  | { ok: true; status: number; data: T; durationMs: number }
  | { ok: false; status: number; error: NormalizedError; durationMs: number };

export class ConfigurationError extends Error {
  constructor() {
    super("SGAI_API_KEY is not configured");
    this.name = "ConfigurationError";
  }
}

function getApiKey(): string | undefined {
  return process.env.SGAI_API_KEY?.trim() || undefined;
}

function getBaseUrl(): string {
  const base = process.env.SGAI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

interface RequestOptions {
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
  timeoutMs?: number;
}

/**
 * Central client for the ScrapeGraphAI V2 API. Runs server-side only.
 * Logs nothing but {id, endpoint, status, durationMs} — never headers, keys,
 * cookies, prompts, or extracted content.
 */
export async function sgaiRequest<T = unknown>(
  method: SgaiMethod,
  path: string,
  options: RequestOptions = {},
): Promise<SgaiResult<T>> {
  const apiKey = getApiKey();
  const callId = randomUUID();
  const start = Date.now();

  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      error: normalizeError(500, undefined, undefined, "configuration"),
      durationMs: Date.now() - start,
    };
  }

  const url = new URL(`${getBaseUrl()}${API_PREFIX}${path}`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  let attempt = 0;
  let lastError: NormalizedError | undefined;
  let lastStatus = 0;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          "SGAI-APIKEY": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      const durationMs = Date.now() - start;
      const status = response.status;
      lastStatus = status;

      logCall(callId, path, status, durationMs);

      if (response.ok) {
        const data = await safeJson(response);
        return { ok: true, status, data: data as T, durationMs };
      }

      const bodyJson = await safeJson(response);
      const message = extractMessage(bodyJson);
      const details = extractDetails(bodyJson);
      lastError = normalizeError(status, message, details);

      if (RETRYABLE_STATUS.has(status) && attempt < MAX_RETRIES) {
        const delay = retryDelayMs(response, attempt);
        await sleep(delay);
        continue;
      }

      return { ok: false, status, error: lastError, durationMs };
    } catch (err) {
      clearTimeout(timeout);
      const durationMs = Date.now() - start;
      const isAbort = err instanceof Error && err.name === "AbortError";
      lastStatus = 0;
      lastError = isAbort
        ? normalizeError(504, undefined, undefined, "timeout")
        : normalizeError(0, undefined, undefined, "network");

      logCall(callId, path, isAbort ? 504 : 0, durationMs);

      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return { ok: false, status: lastStatus, error: lastError, durationMs };
    }
  }

  return {
    ok: false,
    status: lastStatus,
    error: lastError ?? normalizeError(500, undefined, undefined, "unknown"),
    durationMs: Date.now() - start,
  };
}

function logCall(id: string, endpoint: string, status: number, durationMs: number) {
  console.info(
    JSON.stringify({ scope: "sgai_client", id, endpoint, status, durationMs }),
  );
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1000) };
  }
}

function extractMessage(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (record.error && typeof record.error === "object") {
      const errorRecord = record.error as Record<string, unknown>;
      if (typeof errorRecord.message === "string") return errorRecord.message;
    }
    if (typeof record.detail === "string") return record.detail;
  }
  return undefined;
}

function extractDetails(body: unknown): unknown {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (record.details !== undefined) return record.details;
    if (record.error && typeof record.error === "object") {
      const errorRecord = record.error as Record<string, unknown>;
      if (errorRecord.details !== undefined) return errorRecord.details;
    }
  }
  return undefined;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds)) return Math.min(seconds * 1000, 15_000);
    const date = new Date(retryAfter).getTime();
    if (!Number.isNaN(date)) return Math.max(0, Math.min(date - Date.now(), 15_000));
  }
  return backoffMs(attempt);
}

function backoffMs(attempt: number): number {
  const base = 500 * 2 ** (attempt - 1);
  const jitter = Math.random() * 200;
  return Math.min(base + jitter, 8_000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
