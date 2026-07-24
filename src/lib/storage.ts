"use client";

/**
 * Thin localStorage wrapper. Only ever used for non-sensitive UI state:
 * last selected sidebar item, visual preferences and draft form values that
 * cannot contain credentials (see README "Persistência local"). Never store
 * headers, cookies, API keys or webhook secrets here.
 */
const PREFIX = "triad3-search:";

export function storageGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function storageSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy-mode failures — persistence is a nice-to-have.
  }
}

export function storageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // no-op
  }
}
