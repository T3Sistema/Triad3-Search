import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Same approach as the other migration tests in this directory: real Postgres
// behavior can't be exercised without a live database, so this asserts the
// migration SQL is configured additively, as required by src/server/neo/entity-memory.ts.
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "20260724030000_adicionar_memoria_neo.sql");
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

describe("neo entidades_ativas migration", () => {
  it("adds entidades_ativas to neo_conversas additively", () => {
    expect(sql).toContain("alter table neo_conversas add column if not exists entidades_ativas jsonb");
  });

  it("never drops or alters an existing column — additive only", () => {
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("alter column");
  });
});
