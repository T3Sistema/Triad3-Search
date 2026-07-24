/**
 * The single limit the browser also needs to know (composer max length),
 * kept here so it's bundle-safe. Every other Neo limit is operational and
 * lives server-only in src/server/neo/limits.ts, which imports this value
 * as its source of truth instead of duplicating the number.
 */
export const NEO_MESSAGE_MAX_LENGTH = 8_000;
