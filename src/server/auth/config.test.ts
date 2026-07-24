import { afterEach, describe, expect, it, vi } from "vitest";

describe("session cookie configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is always HttpOnly and SameSite=Lax on path /", async () => {
    const { buildSessionCookie } = await import("./config");
    const cookie = buildSessionCookie("token-value", false);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
    expect(cookie.name).toBe("triad3_session");
    expect(cookie.value).toBe("token-value");
  });

  it("is Secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { buildSessionCookie } = await import("./config");
    expect(buildSessionCookie("t", false).secure).toBe(true);
  });

  it("is not Secure outside production (so it still works over plain http in local dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { buildSessionCookie } = await import("./config");
    expect(buildSessionCookie("t", false).secure).toBe(false);
  });

  it("defaults to an 8-hour session", async () => {
    const { buildSessionCookie, SESSION_DURATION_MS_DEFAULT } = await import("./config");
    expect(SESSION_DURATION_MS_DEFAULT).toBe(8 * 60 * 60 * 1000);
    expect(buildSessionCookie("t", false).maxAge).toBe(8 * 60 * 60);
  });

  it('extends to 30 days with "manter conectado"', async () => {
    const { buildSessionCookie, SESSION_DURATION_MS_MANTER_CONECTADO } = await import("./config");
    expect(SESSION_DURATION_MS_MANTER_CONECTADO).toBe(30 * 24 * 60 * 60 * 1000);
    expect(buildSessionCookie("t", true).maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("buildExpiredSessionCookie clears the cookie immediately", async () => {
    const { buildExpiredSessionCookie } = await import("./config");
    const cookie = buildExpiredSessionCookie();
    expect(cookie.maxAge).toBe(0);
    expect(cookie.value).toBe("");
    expect(cookie.httpOnly).toBe(true);
  });

  it("honors a custom SESSION_COOKIE_NAME", async () => {
    vi.stubEnv("SESSION_COOKIE_NAME", "outro_nome");
    vi.resetModules();
    const { SESSION_COOKIE_NAME } = await import("./config");
    expect(SESSION_COOKIE_NAME).toBe("outro_nome");
  });
});
