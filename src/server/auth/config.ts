// Pure constants + cookie-shape builder — no secrets, no DB access. Imported
// by src/proxy.ts (optimistic cookie-presence check) as well as by the
// server-only session modules, so it deliberately has no "server-only"
// import of its own.

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME?.trim() || "triad3_session";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SESSION_DURATION_MS_DEFAULT = 8 * HOUR_MS;
export const SESSION_DURATION_MS_MANTER_CONECTADO = 30 * DAY_MS;

export function sessionDurationMs(manterConectado: boolean): number {
  return manterConectado ? SESSION_DURATION_MS_MANTER_CONECTADO : SESSION_DURATION_MS_DEFAULT;
}

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number; // seconds
}

export function buildSessionCookie(token: string, manterConectado: boolean): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(sessionDurationMs(manterConectado) / 1000),
  };
}

export function buildExpiredSessionCookie(): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
