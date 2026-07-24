import { beforeEach, describe, expect, it, vi } from "vitest";

const obterSessaoAtual = vi.fn();
vi.mock("@/server/auth/sessions", () => ({
  obterSessaoAtual: () => obterSessaoAtual(),
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /login (server-side authenticated-visitor redirect)", () => {
  it("redirects an already-authenticated visitor to the panel home", async () => {
    obterSessaoAtual.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "ana@triad3.com" });

    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/");
  });

  it("sends an authenticated visitor back to the originally requested (sanitized) page", async () => {
    obterSessaoAtual.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "ana@triad3.com" });

    await expect(Page({ searchParams: Promise.resolve({ retorno: "/extract" }) })).rejects.toThrow(
      "REDIRECT:/extract",
    );
  });

  it("rejects an external retorno and falls back to the panel home", async () => {
    obterSessaoAtual.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "ana@triad3.com" });

    await expect(
      Page({ searchParams: Promise.resolve({ retorno: "https://evil.com" }) }),
    ).rejects.toThrow("REDIRECT:/");
  });

  it("renders the login screen (no redirect) for a visitor without a session", async () => {
    obterSessaoAtual.mockResolvedValueOnce(null);

    const result = await Page({ searchParams: Promise.resolve({}) });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
