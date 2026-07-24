// Shared client+server validation helpers for authentication. No secrets, no
// DB access — safe to import from both the admin CLI script and the app.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 12;

/** Lowercases and trims an e-mail so lookups/inserts are always consistent. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const value = email.trim();
  return value.length > 0 && value.length <= 320 && EMAIL_PATTERN.test(value);
}

export function isStrongPassword(senha: string): boolean {
  return senha.length >= MIN_PASSWORD_LENGTH;
}
