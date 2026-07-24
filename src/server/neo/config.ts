import "server-only";

/** Reads the LLM provider key fresh on every call — never cached, never logged. */
export function getNeoApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}

export function isNeoConfigured(): boolean {
  return Boolean(getNeoApiKey());
}
