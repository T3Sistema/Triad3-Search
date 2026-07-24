import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Real Postgres behavior (UUID generation, RLS enforcement) can't be
// exercised without a live database, so this is a content assertion on the
// migration SQL itself: it checks the schema is *configured* to do the
// things the auth design depends on.
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "20260724000000_criar_tabelas_autenticacao.sql");
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("auth tables migration", () => {
  it("enables the extensions UUID generation and citext depend on", () => {
    expect(sql).toContain("create extension if not exists citext");
    expect(sql).toContain("create extension if not exists pgcrypto");
  });

  it("generates every table's id as a random UUID by default (usuarios, sessoes, tentativas_login)", () => {
    expect(sql).toMatch(/id uuid primary key default gen_random_uuid\(\)/);
    const idDefaultCount = (sql.match(/id uuid primary key default gen_random_uuid\(\)/g) ?? []).length;
    expect(idDefaultCount).toBe(3);
  });

  it("never adds a plaintext password column", () => {
    expect(sql).toContain("password_hash text not null");
    expect(sql).not.toContain("password text");
    expect(sql).not.toContain("senha text");
  });

  it("stores only the token hash, never the raw token", () => {
    expect(sql).toContain("token_hash text not null unique");
    expect(sql).not.toContain("token text");
  });

  it("has a case-insensitive unique index on e-mail", () => {
    expect(sql).toContain("email citext not null");
    expect(sql).toContain("create unique index if not exists usuarios_email_key on usuarios (email)");
  });

  it("rejects empty name/e-mail/password via check constraints", () => {
    expect(sql).toContain("check (btrim(nome) <> '')");
    expect(sql).toContain("check (btrim(email::text) <> '')");
    expect(sql).toContain("check (btrim(password_hash) <> '')");
  });

  it("auto-updates atualizado_em on usuarios", () => {
    expect(sql).toContain("before update on usuarios");
    expect(sql).toContain("new.atualizado_em = now()");
  });

  it("enables RLS on all three auth tables and grants no policy to anon/authenticated", () => {
    for (const table of ["usuarios", "sessoes", "tentativas_login"]) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`revoke all on ${table} from anon, authenticated`);
    }
    expect(sql).not.toContain("create policy");
  });

  it("has a persistent, hashed-only login-attempts table for rate limiting", () => {
    expect(sql).toContain("create table if not exists tentativas_login");
    expect(sql).toContain("email_hash text not null");
    expect(sql).toContain("ip_hash text");
    expect(sql).not.toContain("email text");
  });
});
