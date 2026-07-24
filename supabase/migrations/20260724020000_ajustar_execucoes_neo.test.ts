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

  it("uniquely indexes execucao_id — one execution can never end up linked to more than one message", () => {
    expect(sql).toContain("create unique index if not exists neo_mensagens_execucao_id_idx");
    expect(sql).toContain("on neo_mensagens (execucao_id)");
  });

  it("backfills execucao_id for pre-existing rows instead of leaving old executions unreconcilable", () => {
    expect(sql).toContain("update neo_mensagens am");
    expect(sql).toContain("set execucao_id = candidatos.execucao_id");
  });

  it("picks only the single nearest assistant message per execution (row_number/posicao = 1), never every message in the window", () => {
    expect(sql).toContain("row_number() over");
    expect(sql).toContain("partition by ex.id");
    expect(sql).toContain("candidatos.posicao = 1");
  });

  it("computes the window's upper bound from every user message in the conversation, not only ones with an execution", () => {
    expect(sql).toContain("from neo_mensagens um");
    expect(sql).toContain("where um.papel = 'usuario'");
    // The window CTE reads straight from neo_mensagens (all user messages), not through a
    // join against neo_execucoes — that join only happens later, per execution.
    const janelasBlock = sql.slice(sql.indexOf("usuario_janelas as"), sql.indexOf("candidatos as"));
    expect(janelasBlock).not.toContain("neo_execucoes");
  });

  it("never overwrites an existing execucao_id", () => {
    expect(sql).toContain("and am.execucao_id is null");
  });

  it("never drops or alters an existing column — additive only", () => {
    expect(sql).not.toContain("drop column");
    expect(sql).not.toContain("drop table");
    expect(sql).not.toContain("alter column");
  });
});

// ---------------------------------------------------------------------------
// Verified logic mirror of the backfill CTE above.
//
// This project's migrations are asserted by SQL-content checks only — there is
// no live Postgres in CI (see the comment at the top of this file and of
// schema.test.ts). The exact algorithm below (window per user message computed
// over ALL user messages, then rank candidate assistant messages per execution
// by (criado_em, id) and keep only rank 1, never overwrite an existing link) was
// hand-verified against a real local Postgres 16 instance with the fixtures used
// here — including a duplicate-key failure that caught a real idempotency bug
// (candidate ranking must never look at `execucao_id`, only the final UPDATE's
// WHERE clause may) before this migration was committed. Keep this mirror and
// the SQL above in sync if either one changes.
// ---------------------------------------------------------------------------

interface Mensagem {
  id: string;
  papel: "usuario" | "assistente";
  criadoEm: string;
}

interface Execucao {
  id: string;
  mensagemUsuarioId: string;
}

function compareChave(a: Mensagem, b: Mensagem): number {
  if (a.criadoEm !== b.criadoEm) return a.criadoEm < b.criadoEm ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function backfillExecucaoId(mensagens: Mensagem[], execucoes: Execucao[], vinculosExistentes: Record<string, string> = {}): Record<string, string> {
  const usuarios = mensagens.filter((m) => m.papel === "usuario").sort(compareChave);
  const limiteSuperior = new Map<string, Mensagem | null>();
  usuarios.forEach((u, i) => limiteSuperior.set(u.id, usuarios[i + 1] ?? null));

  const vinculos = { ...vinculosExistentes };
  for (const execucao of execucoes) {
    const mensagemUsuario = mensagens.find((m) => m.id === execucao.mensagemUsuarioId);
    if (!mensagemUsuario) continue;
    const proximaUsuario = limiteSuperior.get(mensagemUsuario.id) ?? null;

    const candidatas = mensagens
      .filter((m) => m.papel === "assistente")
      .filter((m) => compareChave(m, mensagemUsuario) > 0)
      .filter((m) => proximaUsuario === null || compareChave(m, proximaUsuario) < 0)
      .sort(compareChave);

    const maisProxima = candidatas[0];
    if (!maisProxima) continue;
    if (vinculos[maisProxima.id]) continue; // nunca sobrescreve
    vinculos[maisProxima.id] = execucao.id;
  }
  return vinculos;
}

describe("backfillExecucaoId (espelho verificado da CTE de backfill)", () => {
  it("vincula apenas a mensagem de assistente mais próxima quando há várias na mesma janela", () => {
    const mensagens: Mensagem[] = [
      { id: "u1", papel: "usuario", criadoEm: "2026-01-01T00:10:00Z" },
      { id: "b1", papel: "assistente", criadoEm: "2026-01-01T00:11:00Z" }, // correta
      { id: "b2", papel: "assistente", criadoEm: "2026-01-01T00:12:00Z" }, // espúria, mesma janela
      { id: "u2", papel: "usuario", criadoEm: "2026-01-01T00:13:00Z" },
    ];
    const execucoes: Execucao[] = [{ id: "ex1", mensagemUsuarioId: "u1" }];
    const vinculos = backfillExecucaoId(mensagens, execucoes);
    expect(vinculos).toEqual({ b1: "ex1" });
    expect(vinculos.b2).toBeUndefined();
  });

  it("usa TODAS as mensagens de usuário para fechar a janela — uma mensagem órfã (sem execução) delimita corretamente a execução anterior", () => {
    const mensagens: Mensagem[] = [
      { id: "u1", papel: "usuario", criadoEm: "2026-01-01T00:00:00Z" },
      { id: "u2", papel: "usuario", criadoEm: "2026-01-01T00:01:00Z" }, // órfã, sem execução
      { id: "a1", papel: "assistente", criadoEm: "2026-01-01T00:02:00Z" }, // cai na janela de u2, não de u1
      { id: "u3", papel: "usuario", criadoEm: "2026-01-01T00:03:00Z" },
      { id: "a2", papel: "assistente", criadoEm: "2026-01-01T00:04:00Z" }, // placeholder correto de ex3
    ];
    const execucoes: Execucao[] = [
      { id: "ex1", mensagemUsuarioId: "u1" },
      { id: "ex3", mensagemUsuarioId: "u3" },
    ];
    const vinculos = backfillExecucaoId(mensagens, execucoes);
    // a1 nunca vai para ex1 — se a janela de ex1 fosse calculada só com mensagens de
    // usuário que têm execução (o bug antigo), ela se estenderia até u3 e capturaria a1.
    expect(vinculos.a1).toBeUndefined();
    expect(vinculos).toEqual({ a2: "ex3" });
  });

  it("mensagens de usuário consecutivas (sem nenhuma mensagem de assistente entre elas) não vinculam nada por engano", () => {
    const mensagens: Mensagem[] = [
      { id: "u1", papel: "usuario", criadoEm: "2026-01-01T00:00:00Z" },
      { id: "u2", papel: "usuario", criadoEm: "2026-01-01T00:00:01Z" },
      { id: "a1", papel: "assistente", criadoEm: "2026-01-01T00:00:02Z" }, // pertence à janela de u2
    ];
    const execucoes: Execucao[] = [
      { id: "ex1", mensagemUsuarioId: "u1" },
      { id: "ex2", mensagemUsuarioId: "u2" },
    ];
    const vinculos = backfillExecucaoId(mensagens, execucoes);
    expect(vinculos).toEqual({ a1: "ex2" });
  });

  it("nunca sobrescreve um execucao_id já preenchido, mesmo que outra execução pareça ser uma correspondência melhor", () => {
    const mensagens: Mensagem[] = [
      { id: "u1", papel: "usuario", criadoEm: "2026-01-01T00:00:00Z" },
      { id: "a1", papel: "assistente", criadoEm: "2026-01-01T00:00:01Z" },
    ];
    const execucoes: Execucao[] = [{ id: "ex1", mensagemUsuarioId: "u1" }];
    const vinculos = backfillExecucaoId(mensagens, execucoes, { a1: "ex-ja-vinculada" });
    expect(vinculos.a1).toBe("ex-ja-vinculada");
  });

  it("é idempotente: rodar duas vezes sobre o próprio resultado não muda nada", () => {
    const mensagens: Mensagem[] = [
      { id: "u1", papel: "usuario", criadoEm: "2026-01-01T00:10:00Z" },
      { id: "b1", papel: "assistente", criadoEm: "2026-01-01T00:11:00Z" },
      { id: "b2", papel: "assistente", criadoEm: "2026-01-01T00:12:00Z" },
      { id: "u2", papel: "usuario", criadoEm: "2026-01-01T00:13:00Z" },
    ];
    const execucoes: Execucao[] = [{ id: "ex1", mensagemUsuarioId: "u1" }];
    const primeira = backfillExecucaoId(mensagens, execucoes);
    const segunda = backfillExecucaoId(mensagens, execucoes, primeira);
    expect(segunda).toEqual(primeira);
    // Crucialmente, b2 continua sem dono na segunda rodada — nunca "rouba" o
    // vínculo de b1 só porque b1 já está fora da lista de candidatas livres.
    expect(segunda.b2).toBeUndefined();
  });

  it("garante vínculo único: nenhuma mensagem aparece como valor de duas execuções diferentes", () => {
    const mensagens: Mensagem[] = [
      { id: "u1", papel: "usuario", criadoEm: "2026-01-01T00:00:00Z" },
      { id: "a1", papel: "assistente", criadoEm: "2026-01-01T00:00:01Z" },
      { id: "u2", papel: "usuario", criadoEm: "2026-01-01T00:01:00Z" },
      { id: "a2", papel: "assistente", criadoEm: "2026-01-01T00:01:01Z" },
    ];
    const execucoes: Execucao[] = [
      { id: "ex1", mensagemUsuarioId: "u1" },
      { id: "ex2", mensagemUsuarioId: "u2" },
    ];
    const vinculos = backfillExecucaoId(mensagens, execucoes);
    const valores = Object.values(vinculos);
    expect(new Set(valores).size).toBe(valores.length);
  });
});
