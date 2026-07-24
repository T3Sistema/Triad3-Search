import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Same approach as schema.test.ts / 20260724010000_criar_tabelas_neo.test.ts: real
// Postgres behavior can't be exercised without a live database, so this asserts the
// migration SQL is *configured* to do what the orphan-execution reconciliation
// (src/server/neo/reconciliation.ts) depends on.
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "20260724020000_ajustar_execucoes_neo.sql");
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("neo heartbeat + mensagem-execucao link migration", () => {
  it("adds ultimo_heartbeat_em to neo_execucoes additively", () => {
    expect(sql).toContain("alter table neo_execucoes add column if not exists ultimo_heartbeat_em timestamptz");
  });

  it("adds a nullable execucao_id foreign key to neo_mensagens additively", () => {
    expect(sql).toContain(
      "alter table neo_mensagens add column if not exists execucao_id uuid references neo_execucoes(id) on delete set null",
    );
  });

  it("indexes execucao_id for the reconciliation lookup", () => {
    expect(sql).toContain("create index if not exists neo_mensagens_execucao_id_idx");
    expect(sql).toContain("on neo_mensagens (execucao_id)");
  });

  it("backfills execucao_id for pre-existing rows instead of leaving old executions unreconcilable", () => {
    expect(sql).toContain("update neo_mensagens am");
    expect(sql).toContain("set execucao_id = alvo.execucao_id");
  });

  it("never drops or alters an existing column — additive only", () => {
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("alter column");
  });
});
