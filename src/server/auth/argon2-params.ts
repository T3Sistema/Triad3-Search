// No secrets here — just tuning constants, shared between the app's runtime
// password check and the standalone admin CLI script (scripts/create-user.ts,
// which can't import "server-only" modules), so both hash with identical
// parameters.
//
// `algorithm: 2` is @node-rs/argon2's `Algorithm.Argon2id` — the numeric
// value is used directly because it's an ambient `const enum`, which
// isolatedModules (required by this project's build) can't import.
export const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;
