import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase is used exclusively as the Postgres database here — no
 * Supabase Auth, no client-side SDK usage. SUPABASE_SECRET_KEY is the
 * server-only secret key (bypasses RLS by design); it must never reach the
 * browser, logs, or error responses.
 */
export class DatabaseConfigurationError extends Error {
  constructor() {
    super("SUPABASE_URL or SUPABASE_SECRET_KEY is not configured");
    this.name = "DatabaseConfigurationError";
  }
}

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    throw new DatabaseConfigurationError();
  }

  client = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
