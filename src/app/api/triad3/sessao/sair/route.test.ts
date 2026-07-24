import { afterEach, describe, expect, it, vi } from "vitest";

const revogarSessao = vi.fn();

vi.mock("@/server/auth/sessions", () => ({
  revogarSessao: (...args: unknown[]) => revogarSessao(...args),
  obterSessaoAtual: vi.fn(),
}));

import { POST } from "./route";

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/triad3/sessao/sair", { method: "POST", headers });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/triad3/sessao/sair", () => {
  it("rejects requests from an untrusted cross-site origin", async () => {
    const response = await POST(makeRequest({ "sec-fetch-site": "cross-site" }));
    expect(response.status).toBe(403);
  });

  it("revokes the session and clears the cookie", async () => {
    revogarSessao.mockResolvedValueOnce(undefined);
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(revogarSessao).toHaveBeenCalledTimes(1);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("triad3_session=");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");
  });

  it("still succeeds and clears the cookie when there was no session to revoke", async () => {
    revogarSessao.mockResolvedValueOnce(undefined); // revogarSessao() is itself a safe no-op with no cookie
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
