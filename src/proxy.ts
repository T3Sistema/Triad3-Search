import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/config";
import { sanitizeInternalPath } from "@/lib/auth/redirect-target";

/**
 * This only does an OPTIMISTIC check — whether the session cookie is
 * present — purely to avoid rendering a page that's just going to redirect
 * anyway. It never touches the database and is NOT the real protection
 * layer: a present-but-expired/revoked cookie sails through here and is
 * only caught by the real, DB-validated check in `(app)/layout.tsx`
 * (`exigirUsuario()`) and in every private API route (`requireApiUser()`).
 *
 * `/login` is deliberately never redirected away from here (even when a
 * cookie is present) — that decision needs the real validity check too, and
 * doing it here on cookie-presence alone would risk a redirect loop for
 * anyone holding a stale cookie.
 */
const PUBLIC_PATHS = new Set(["/login"]);
const PATH_HEADER = "x-triad3-path";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers: withPathHeader(request, pathname) } });
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("retorno", sanitizeInternalPath(pathname, "/"));
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: withPathHeader(request, pathname) } });
}

function withPathHeader(request: NextRequest, pathname: string): Headers {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, pathname);
  return headers;
}

export const config = {
  matcher: ["/((?!api/|_next/|favicon.ico|branding/).*)"],
};
