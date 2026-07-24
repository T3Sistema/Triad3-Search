import { describe, expect, it, vi } from "vitest";

const obterSessaoAtual = vi.fn();
vi.mock("@/server/auth/sessions", () => ({
  obterSessaoAtual: () => obterSessaoAtual(),
}));

import { requireApiUser } from "./api-utils";

describe("requireApiUser", () => {
  it("denies access with a generic 401 when there is no valid session", async () => {
    obterSessaoAtual.mockResolvedValueOnce(null);
    const result = await requireApiUser();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok:false");
    expect(result.response.status).toBe(401);

    const body = await result.response.json();
    expect(body.error.type).toBe("unauthorized");
  });

  it("never leaks a password hash, token, or vendor name in the denial response", async () => {
    obterSessaoAtual.mockResolvedValueOnce(null);
    const result = await requireApiUser();
    if (result.ok) throw new Error("expected ok:false");
    const text = await result.response.text();

    expect(text.toLowerCase()).not.toContain("password");
    expect(text.toLowerCase()).not.toContain("hash");
    expect(text.toLowerCase()).not.toContain("token");
    expect(text.toLowerCase()).not.toContain("supabase");
  });

  it("returns only public fields for the authenticated user", async () => {
    obterSessaoAtual.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "ana@triad3.com" });
    const result = await requireApiUser();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok:true");
    expect(result.user).toEqual({ id: "u1", nome: "Ana", email: "ana@triad3.com" });
  });
});
