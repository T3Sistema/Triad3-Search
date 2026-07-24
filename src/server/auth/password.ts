import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { ARGON2_OPTIONS } from "./argon2-params";

export async function hashPassword(senha: string): Promise<string> {
  return hash(senha, ARGON2_OPTIONS);
}

export async function verifyPassword(hashArmazenado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch {
    return false;
  }
}

// Real Argon2id hash of an arbitrary placeholder (never a real password),
// computed once and memoized. Running a genuine verify() against it when no
// account matches keeps failed-login timing indistinguishable from a real
// password check, so response time can't be used to enumerate accounts.
let dummyHashPromise: Promise<string> | null = null;

function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hash("triad3-search-timing-parity-placeholder", ARGON2_OPTIONS);
  }
  return dummyHashPromise;
}

export async function verifyDummyPassword(senha: string): Promise<void> {
  try {
    const dummyHash = await getDummyHash();
    await verify(dummyHash, senha);
  } catch {
    // Discarded — this call exists purely for timing parity, not its result.
  }
}
