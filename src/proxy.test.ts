import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function makeRequest(path: string, cookieHeader?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("proxy (optimistic cookie check — not the real protection)", () => {
  it("redirects an unauthenticated visitor away from a protected page to /login", () => {
    const response = proxy(makeRequest("/extract"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("retorno")).toBe("/extract");
  });

  it("redirects an unauthenticated visitor at the root to /login without a retorno param", () => {
    const response = proxy(makeRequest("/"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.has("retorno")).toBe(false);
  });

  it("lets a request with a session cookie through, without redirecting", () => {
    const response = proxy(makeRequest("/extract", "triad3_session=some-token-value"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("never redirects away from /login itself, even without a cookie", () => {
    const response = proxy(makeRequest("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("never redirects away from /login even when a (possibly stale) cookie is present — avoids a redirect loop", () => {
    const response = proxy(makeRequest("/login", "triad3_session=stale-or-invalid"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("builds a safe, sanitized retorno value even for a path with query-like characters", () => {
    const response = proxy(makeRequest("/mapear/123"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("retorno")).toBe("/mapear/123");
  });
});
