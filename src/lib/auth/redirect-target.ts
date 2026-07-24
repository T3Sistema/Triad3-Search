// Shared client+server helper that decides where to send the user after
// login, or where to bounce an unauthenticated visitor back to once they've
// signed in. No secrets — safe to import anywhere.
//
// Only ever returns an internal, single-leading-slash path. Rejects anything
// that could be interpreted as a protocol-relative or absolute URL by a
// browser (open-redirect protection), including after percent-decoding.

const MAX_LENGTH = 512;

function hasControlOrBackslash(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || value[i] === "\\") return true;
  }
  return false;
}

function looksUnsafe(value: string): boolean {
  return value.startsWith("//") || hasControlOrBackslash(value);
}

export function sanitizeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (looksUnsafe(value)) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (looksUnsafe(decoded)) return fallback;
  } catch {
    return fallback;
  }

  return value;
}
