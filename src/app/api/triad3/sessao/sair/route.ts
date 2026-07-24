import { NextResponse } from "next/server";
import { rejectUntrustedOrigin } from "@/lib/api-utils";
import { revogarSessao } from "@/server/auth/sessions";
import { buildExpiredSessionCookie } from "@/server/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Works even when the session is already expired/revoked/missing — logout
// must always succeed and always clear the cookie.
export async function POST(request: Request) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  await revogarSessao();

  const response = NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  const cookie = buildExpiredSessionCookie();
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
