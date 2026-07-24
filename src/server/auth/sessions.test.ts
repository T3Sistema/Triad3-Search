import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const inserirSessao = vi.fn();
const selecionarSessaoComUsuarioPorTokenHash = vi.fn();
const atualizarUltimoAcesso = vi.fn();
const revogarSessaoPorTokenHash = vi.fn();
const excluirSessoesExpiradas = vi.fn();

vi.mock("@/server/db/repositories/sessoes", () => ({
  inserirSessao: (...args: unknown[]) => inserirSessao(...args),
  selecionarSessaoComUsuarioPorTokenHash: (...args: unknown[]) => selecionarSessaoComUsuarioPorTokenHash(...args),
  atualizarUltimoAcesso: (...args: unknown[]) => atualizarUltimoAcesso(...args),
  revogarSessaoPorTokenHash: (...args: unknown[]) => revogarSessaoPorTokenHash(...args),
  excluirSessoesExpiradas: (...args: unknown[]) => excluirSessoesExpiradas(...args),
}));

let cookieValue: string | undefined;
let pathHeaderValue: string | undefined;
const cookieStoreGet = vi.fn(() => (cookieValue === undefined ? undefined : { value: cookieValue }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieStoreGet }),
  headers: async () => ({ get: (name: string) => (name === "x-triad3-path" ? (pathHeaderValue ?? null) : null) }),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

import { criarSessao, exigirUsuario, limparSessoesExpiradas, obterSessaoAtual, revogarSessao } from "./sessions";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieValue = undefined;
  pathHeaderValue = undefined;
  atualizarUltimoAcesso.mockResolvedValue(undefined);
});

describe("criarSessao", () => {
  it("stores only the SHA-256 hash of the token, never the raw token, in the database", async () => {
    inserirSessao.mockResolvedValueOnce(undefined);
    const { token } = await criarSessao({ usuarioId: "u1", manterConectado: false, userAgent: null, ipHash: null });

    expect(token).toBeTruthy();
    expect(inserirSessao).toHaveBeenCalledTimes(1);
    const insertedRow = inserirSessao.mock.calls[0][0];
    expect(insertedRow.tokenHash).toBe(sha256(token));
    expect(insertedRow.tokenHash).not.toBe(token);
    expect(insertedRow.usuarioId).toBe("u1");
  });

  it("generates a cryptographically-sized token (32 random bytes, base64url)", async () => {
    inserirSessao.mockResolvedValueOnce(undefined);
    const { token } = await criarSessao({ usuarioId: "u1", manterConectado: false, userAgent: null, ipHash: null });
    // 32 random bytes base64url-encoded (no padding) is 43 characters.
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("sets an 8-hour expiry by default, 30 days with manterConectado", async () => {
    inserirSessao.mockResolvedValue(undefined);
    const before = Date.now();

    await criarSessao({ usuarioId: "u1", manterConectado: false, userAgent: null, ipHash: null });
    const shortExpiry = new Date(inserirSessao.mock.calls[0][0].expiraEm).getTime();
    expect(shortExpiry - before).toBeGreaterThan(7.9 * 60 * 60 * 1000);
    expect(shortExpiry - before).toBeLessThan(8.1 * 60 * 60 * 1000);

    await criarSessao({ usuarioId: "u1", manterConectado: true, userAgent: null, ipHash: null });
    const longExpiry = new Date(inserirSessao.mock.calls[1][0].expiraEm).getTime();
    expect(longExpiry - before).toBeGreaterThan(29.9 * 24 * 60 * 60 * 1000);
  });
});

describe("obterSessaoAtual", () => {
  it("returns null when there is no session cookie", async () => {
    cookieValue = undefined;
    await expect(obterSessaoAtual()).resolves.toBeNull();
    expect(selecionarSessaoComUsuarioPorTokenHash).not.toHaveBeenCalled();
  });

  it("returns only public fields (id, nome, email) for a valid session", async () => {
    cookieValue = "raw-token";
    selecionarSessaoComUsuarioPorTokenHash.mockResolvedValueOnce({
      usuarioId: "u1",
      expiraEm: new Date(Date.now() + 60_000).toISOString(),
      revogadoEm: null,
      usuarioNome: "Ana",
      usuarioEmail: "ana@triad3.com",
      usuarioAtivo: true,
    });

    const usuario = await obterSessaoAtual();
    expect(usuario).toEqual({ id: "u1", nome: "Ana", email: "ana@triad3.com" });
    expect(selecionarSessaoComUsuarioPorTokenHash).toHaveBeenCalledWith(sha256("raw-token"));
  });

  it("returns null for an expired session", async () => {
    cookieValue = "raw-token";
    selecionarSessaoComUsuarioPorTokenHash.mockResolvedValueOnce({
      usuarioId: "u1",
      expiraEm: new Date(Date.now() - 1000).toISOString(),
      revogadoEm: null,
      usuarioNome: "Ana",
      usuarioEmail: "ana@triad3.com",
      usuarioAtivo: true,
    });

    await expect(obterSessaoAtual()).resolves.toBeNull();
  });

  it("returns null for a revoked session", async () => {
    cookieValue = "raw-token";
    selecionarSessaoComUsuarioPorTokenHash.mockResolvedValueOnce({
      usuarioId: "u1",
      expiraEm: new Date(Date.now() + 60_000).toISOString(),
      revogadoEm: new Date().toISOString(),
      usuarioNome: "Ana",
      usuarioEmail: "ana@triad3.com",
      usuarioAtivo: true,
    });

    await expect(obterSessaoAtual()).resolves.toBeNull();
  });

  it("returns null when the user was deactivated after the session was created", async () => {
    cookieValue = "raw-token";
    selecionarSessaoComUsuarioPorTokenHash.mockResolvedValueOnce({
      usuarioId: "u1",
      expiraEm: new Date(Date.now() + 60_000).toISOString(),
      revogadoEm: null,
      usuarioNome: "Ana",
      usuarioEmail: "ana@triad3.com",
      usuarioAtivo: false,
    });

    await expect(obterSessaoAtual()).resolves.toBeNull();
  });

  it("returns null when the session row doesn't exist", async () => {
    cookieValue = "raw-token";
    selecionarSessaoComUsuarioPorTokenHash.mockResolvedValueOnce(null);
    await expect(obterSessaoAtual()).resolves.toBeNull();
  });
});

describe("exigirUsuario", () => {
  it("returns the user without redirecting when the session is valid", async () => {
    cookieValue = "raw-token";
    selecionarSessaoComUsuarioPorTokenHash.mockResolvedValueOnce({
      usuarioId: "u1",
      expiraEm: new Date(Date.now() + 60_000).toISOString(),
      revogadoEm: null,
      usuarioNome: "Ana",
      usuarioEmail: "ana@triad3.com",
      usuarioAtivo: true,
    });

    await expect(exigirUsuario()).resolves.toEqual({ id: "u1", nome: "Ana", email: "ana@triad3.com" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", async () => {
    cookieValue = undefined;
    pathHeaderValue = "/extract";
    await expect(exigirUsuario()).rejects.toThrow("REDIRECT:/login?retorno=%2Fextract");
  });

  it("redirects to bare /login (no retorno) when the path is the root", async () => {
    cookieValue = undefined;
    pathHeaderValue = "/";
    await expect(exigirUsuario()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("revogarSessao", () => {
  it("revokes the session tied to the current cookie", async () => {
    cookieValue = "raw-token";
    revogarSessaoPorTokenHash.mockResolvedValueOnce(undefined);
    await revogarSessao();
    expect(revogarSessaoPorTokenHash).toHaveBeenCalledWith(sha256("raw-token"));
  });

  it("is a safe no-op when there is no session cookie", async () => {
    cookieValue = undefined;
    await expect(revogarSessao()).resolves.toBeUndefined();
    expect(revogarSessaoPorTokenHash).not.toHaveBeenCalled();
  });
});

describe("limparSessoesExpiradas", () => {
  it("delegates to the repository", async () => {
    excluirSessoesExpiradas.mockResolvedValueOnce(undefined);
    await limparSessoesExpiradas();
    expect(excluirSessoesExpiradas).toHaveBeenCalledTimes(1);
  });
});
