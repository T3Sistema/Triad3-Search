import { describe, expect, it } from "vitest";
import { hashPassword, verifyDummyPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("produces an Argon2id-format hash, never the raw password", async () => {
    const hash = await hashPassword("senha-super-forte-123");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain("senha-super-forte-123");
  });

  it("verifies a correct password against its own hash", async () => {
    const hash = await hashPassword("senha-super-forte-123");
    await expect(verifyPassword(hash, "senha-super-forte-123")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("senha-super-forte-123");
    await expect(verifyPassword(hash, "senha-completamente-errada")).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("senha-super-forte-123");
    const b = await hashPassword("senha-super-forte-123");
    expect(a).not.toBe(b);
  });

  it("verifyPassword never throws on a malformed stored hash", async () => {
    await expect(verifyPassword("not-a-real-hash", "qualquer-coisa")).resolves.toBe(false);
  });

  it("verifyDummyPassword never throws and never resolves to a value used for auth decisions", async () => {
    await expect(verifyDummyPassword("qualquer-senha")).resolves.toBeUndefined();
  });
});
