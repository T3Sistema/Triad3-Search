import "server-only";
import { NextResponse } from "next/server";
import { toErrorResponseBody, type NormalizedError } from "./scrapegraph/errors";

export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024; // 2MB, matches the raw HTML/Markdown limit.

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, {
    ...responseInit,
    headers: { ...NO_STORE_HEADERS, ...(responseInit?.headers ?? {}) },
  });
}

export function jsonError(error: NormalizedError) {
  return NextResponse.json(toErrorResponseBody(error), {
    status: error.httpStatus >= 400 ? error.httpStatus : 502,
    headers: NO_STORE_HEADERS,
  });
}

export function validationErrorResponse(message: string, details?: unknown) {
  return NextResponse.json(
    { error: { type: "validation", message, ...(details ? { details } : {}) } },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

/**
 * Best-effort protection against this panel being embedded/driven by another
 * origin. This is a defense-in-depth layer only — the app has no
 * authentication, so anyone with the URL can already use it directly.
 */
export function isTrustedOrigin(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }

  const origin = request.headers.get("origin");
  if (!origin) return true; // curl / server-to-server tools with no browser headers.

  const host = request.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    return !host || originHost === host;
  } catch {
    return false;
  }
}

/** Returns a 403 response when the request isn't trusted, otherwise null. */
export function rejectUntrustedOrigin(request: Request): NextResponse | null {
  if (isTrustedOrigin(request)) return null;
  return NextResponse.json(
    { error: { type: "forbidden", message: "Origem da requisição não confiável." } },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

export { isHttpUrl } from "./url";

export async function readJsonBody(request: Request): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse }
> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: validationErrorResponse("O corpo da requisição excede o limite de 2 MB."),
    };
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: validationErrorResponse("O corpo da requisição excede o limite de 2 MB."),
    };
  }

  if (!text) return { ok: true, body: {} };

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: validationErrorResponse("Corpo da requisição não é um JSON válido."),
    };
  }
}
