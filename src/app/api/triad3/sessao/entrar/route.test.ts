import { afterEach, describe, expect, it, vi } from "vitest";

const buscarUsuarioParaLogin = vi.fn();
const registrarFalhaLogin = vi.fn();
const registrarLoginSucesso = vi.fn();
const verifyPassword = vi.fn();
const verifyDummyPassword = vi.fn();
const estaBloqueadoPorRateLimit = vi.fn();
const registrarTentativaLogin = vi.fn();
const criarSessao = vi.fn();

vi.mock("@/server/auth/users", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/users")>();
  return {
    ...actual, // keep the real, pure contaTemporariamenteBloqueada
    buscarUsuarioParaLogin: (...args: unknown[]) => buscarUsuarioParaLogin(...args),
    registrarFalhaLogin: (...args: unknown[]) => registrarFalhaLogin(...args),
    registrarLoginSucesso: (...args: unknown[]) => registrarLoginSucesso(...args),
  };
});

vi.mock("@/server/auth/password", () => ({
  verifyPassword: (...args: unknown[]) => verifyPassword(...args),
  verifyDummyPassword: (...args: unknown[]) => verifyDummyPassword(...args),
}));

vi.mock("@/server/auth/rate-limit", () => ({
  estaBloqueadoPorRateLimit: (...args: unknown[]) => estaBloqueadoPorRateLimit(...args),
  registrarTentativaLogin: (...args: unknown[]) => registrarTentativaLogin(...args),
}));

vi.mock("@/server/auth/sessions", () => ({
  criarSessao: (...args: unknown[]) => criarSessao(...args),
  obterSessaoAtual: vi.fn(),
}));

import { POST } from "./route";

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/triad3/sessao/entrar", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

const usuarioBase = {
  id: "u1",
  nome: "Ana",
  email: "ana@triad3.com",
  passwordHash: "$argon2id$stub",
  ativo: true,
  tentativasFalhas: 0,
  bloqueadoAte: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/triad3/sessao/entrar", () => {
  it("rejects requests from an untrusted cross-site origin", async () => {
    const response = await POST(
      makeRequest({ email: "a@b.com", senha: "x" }, { "sec-fetch-site": "cross-site" }),
    );
    expect(response.status).toBe(403);
  });

  it("returns a validation error when e-mail or senha is missing", async () => {
    const response = await POST(makeRequest({ email: "a@b.com" }));
    expect(response.status).toBe(400);
  });

  it("is rate-limited before ever looking up the account", async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(true);

    const response = await POST(makeRequest({ email: "a@b.com", senha: "qualquer" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error.type).toBe("rate_limited");
    expect(buscarUsuarioParaLogin).not.toHaveBeenCalled();
  });

  it("returns a generic error for a non-existent account, without revealing that", async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(false);
    buscarUsuarioParaLogin.mockResolvedValueOnce(null);
    verifyDummyPassword.mockResolvedValueOnce(undefined);
    registrarTentativaLogin.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest({ email: "ninguem@triad3.com", senha: "qualquer-coisa" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.message).toBe("E-mail ou senha inválidos.");
    // Timing parity: a real Argon2id verify still runs even though no account matched.
    expect(verifyDummyPassword).toHaveBeenCalledWith("qualquer-coisa");
    expect(registrarTentativaLogin).toHaveBeenCalledWith(
      expect.objectContaining({ sucesso: false }),
    );
  });

  it("returns the same generic error for an inactive account", async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(false);
    buscarUsuarioParaLogin.mockResolvedValueOnce({ ...usuarioBase, ativo: false });
    verifyDummyPassword.mockResolvedValueOnce(undefined);
    registrarTentativaLogin.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest({ email: "ana@triad3.com", senha: "senha-correta-mas-inativo" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.message).toBe("E-mail ou senha inválidos.");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns the same generic error for a temporarily locked-out account, even with the correct password", async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(false);
    buscarUsuarioParaLogin.mockResolvedValueOnce({
      ...usuarioBase,
      bloqueadoAte: new Date(Date.now() + 60_000).toISOString(),
    });
    verifyDummyPassword.mockResolvedValueOnce(undefined);
    registrarTentativaLogin.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest({ email: "ana@triad3.com", senha: "senha-correta" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.message).toBe("E-mail ou senha inválidos.");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect password and registers the failure", async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(false);
    buscarUsuarioParaLogin.mockResolvedValueOnce({ ...usuarioBase });
    verifyPassword.mockResolvedValueOnce(false);
    registrarTentativaLogin.mockResolvedValueOnce(undefined);
    registrarFalhaLogin.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest({ email: "ana@triad3.com", senha: "senha-errada" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.message).toBe("E-mail ou senha inválidos.");
    expect(registrarFalhaLogin).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
  });

  it("logs in successfully, sets a HttpOnly session cookie, and resets the failure counter", async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(false);
    buscarUsuarioParaLogin.mockResolvedValueOnce({ ...usuarioBase });
    verifyPassword.mockResolvedValueOnce(true);
    registrarTentativaLogin.mockResolvedValueOnce(undefined);
    registrarLoginSucesso.mockResolvedValueOnce(undefined);
    criarSessao.mockResolvedValueOnce({ token: "raw-session-token" });

    const response = await POST(makeRequest({ email: "ana@triad3.com", senha: "senha-correta" }));

    expect(response.status).toBe(200);
    expect(registrarLoginSucesso).toHaveBeenCalledWith("u1");
    expect(criarSessao).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: "u1", manterConectado: false }));

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("triad3_session=raw-session-token");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    // 8h default session -> Max-Age=28800
    expect(setCookie).toContain("Max-Age=28800");
  });

  it('extends the cookie to 30 days when "manter conectado" is set', async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(false);
    buscarUsuarioParaLogin.mockResolvedValueOnce({ ...usuarioBase });
    verifyPassword.mockResolvedValueOnce(true);
    registrarTentativaLogin.mockResolvedValueOnce(undefined);
    registrarLoginSucesso.mockResolvedValueOnce(undefined);
    criarSessao.mockResolvedValueOnce({ token: "raw-session-token" });

    const response = await POST(
      makeRequest({ email: "ana@triad3.com", senha: "senha-correta", manterConectado: true }),
    );

    expect(criarSessao).toHaveBeenCalledWith(expect.objectContaining({ manterConectado: true }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  it("never leaks password_hash, the raw token, or a vendor name in the response body", async () => {
    estaBloqueadoPorRateLimit.mockResolvedValueOnce(false);
    buscarUsuarioParaLogin.mockResolvedValueOnce({ ...usuarioBase });
    verifyPassword.mockResolvedValueOnce(true);
    registrarTentativaLogin.mockResolvedValueOnce(undefined);
    registrarLoginSucesso.mockResolvedValueOnce(undefined);
    criarSessao.mockResolvedValueOnce({ token: "raw-session-token" });

    const response = await POST(makeRequest({ email: "ana@triad3.com", senha: "senha-correta" }));
    const text = await response.text();

    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("raw-session-token");
    expect(text.toLowerCase()).not.toContain("supabase");
    expect(text.toLowerCase()).not.toContain("argon2");
  });
});
