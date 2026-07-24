import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Same approach as schema.test.ts: real Postgres/RLS behavior can't be
// exercised without a live database, so this asserts the migration SQL is
// *configured* to do what the Neo persistence design depends on.
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "20260724010000_criar_tabelas_neo.sql");
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

const TABLES = ["neo_conversas", "neo_mensagens", "neo_execucoes", "neo_etapas", "neo_fontes"];

describe("neo tables migration", () => {
  it("creates all five Neo tables with a random UUID primary key", () => {
    for (const table of TABLES) {
      expect(sql).toContain(`create table if not exists ${table}`);
    }
    const idDefaultCount = (sql.match(/id uuid primary key default gen_random_uuid\(\)/g) ?? []).length;
    expect(idDefaultCount).toBe(TABLES.length);
  });

  it("scopes every conversation and execution to a usuario_id with cascade delete", () => {
    expect(sql).toContain("usuario_id uuid not null references usuarios(id) on delete cascade");
  });

  it("cascades conversation deletion down to messages, executions, steps and sources", () => {
    expect(sql).toContain("conversa_id uuid not null references neo_conversas(id) on delete cascade");
    expect(sql).toContain("execucao_id uuid not null references neo_execucoes(id) on delete cascade");
  });

  it("supports soft delete for conversations", () => {
    expect(sql).toContain("excluido_em timestamptz");
  });

  it("auto-updates atualizado_em on neo_conversas via the shared trigger function", () => {
    expect(sql).toContain("before update on neo_conversas");
    expect(sql).toContain("execute function triad3_set_atualizado_em()");
  });

  it("constrains status columns with check constraints instead of free text", () => {
    expect(sql).toContain("papel in ('usuario', 'assistente', 'sistema')");
    expect(sql).toContain("status in ('planejando', 'executando', 'verificando', 'sintetizando'");
    expect(sql).toContain("tipo in ('ferramenta', 'confirmacao', 'verificacao', 'sintese')");
  });

  it("enforces at most one active execution per conversation at the database level", () => {
    expect(sql).toContain("create unique index if not exists neo_execucoes_conversa_ativa_idx");
    expect(sql).toContain("on neo_execucoes (conversa_id)");
  });

  it("enforces idempotent execution submission per conversation", () => {
    expect(sql).toContain("create unique index if not exists neo_execucoes_idempotency_key_idx");
    expect(sql).toContain("on neo_execucoes (conversa_id, idempotency_key)");
  });

  it("deduplicates sources by execution + URL", () => {
    expect(sql).toContain("create unique index if not exists neo_fontes_execucao_url_idx on neo_fontes (execucao_id, url)");
  });

  it("keeps the paused tool-loop resumption state out of any indexable/queryable column name", () => {
    expect(sql).toContain("contexto_pendente jsonb");
  });

  it("never stores secrets, prompts, keys, tokens or cookies", () => {
    for (const forbidden of ["password", "senha", "token text", "api_key", "apikey", "cookie", "prompt_sistema"]) {
      expect(sql).not.toContain(forbidden);
    }
  });

  it("enables RLS on all five tables and grants no policy to anon/authenticated", () => {
    for (const table of TABLES) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`revoke all on ${table} from anon, authenticated`);
    }
    expect(sql).not.toContain("create policy");
  });
});
