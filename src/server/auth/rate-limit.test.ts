import { describe, expect, it, vi } from "vitest";

const contarFalhasRecentes = vi.fn();
const inserirTentativaLogin = vi.fn();

vi.mock("@/server/db/repositories/tentativas-login", () => ({
  contarFalhasRecentes: (...args: unknown[]) => contarFalhasRecentes(...args),
  inserirTentativaLogin: (...args: unknown[]) => inserirTentativaLogin(...args),
}));

import { estaBloqueadoPorRateLimit, MAX_TENTATIVAS, registrarTentativaLogin } from "./rate-limit";

describe("rate limit", () => {
  it("is not blocked below the threshold", async () => {
    contarFalhasRecentes.mockResolvedValueOnce(MAX_TENTATIVAS - 1);
    await expect(estaBloqueadoPorRateLimit({ emailHash: "abc" })).resolves.toBe(false);
  });

  it("blocks once the threshold is reached, within the rolling window", async () => {
    contarFalhasRecentes.mockResolvedValueOnce(MAX_TENTATIVAS);
    await expect(estaBloqueadoPorRateLimit({ emailHash: "abc" })).resolves.toBe(true);
  });

  it("blocks unknown e-mails identically to known ones (no account-existence oracle)", async () => {
    contarFalhasRecentes.mockResolvedValueOnce(MAX_TENTATIVAS);
    await expect(estaBloqueadoPorRateLimit({ emailHash: "hash-de-email-inexistente" })).resolves.toBe(true);
  });

  it("records attempts through the persistent repository, not in-memory", async () => {
    inserirTentativaLogin.mockResolvedValueOnce(undefined);
    await registrarTentativaLogin({ emailHash: "abc", ipHash: "def", sucesso: false });
    expect(inserirTentativaLogin).toHaveBeenCalledWith({ emailHash: "abc", ipHash: "def", sucesso: false });
  });
});
