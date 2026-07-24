"use client";

export class ApiRequestError extends Error {
  type: string;
  details?: unknown;
  originalMessage?: string;
  status: number;

  constructor(status: number, type: string, message: string, originalMessage?: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.type = type;
    this.details = details;
    this.originalMessage = originalMessage;
  }
}

interface ApiFetchOptions extends RequestInit {
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? safeParse(text) : null;

  if (!response.ok) {
    const errorBody = data as { error?: { type?: string; message?: string; originalMessage?: string; details?: unknown } } | null;
    const error = errorBody?.error;
    throw new ApiRequestError(
      response.status,
      error?.type ?? "unknown",
      error?.message ?? "Ocorreu um erro inesperado.",
      error?.originalMessage,
      error?.details,
    );
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body), signal });
}

export function apiPatch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body), signal });
}

export function apiDelete<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE", signal });
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiFetch<T>(path, { method: "GET", signal });
}
