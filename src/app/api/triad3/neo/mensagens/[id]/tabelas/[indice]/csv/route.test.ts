import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/neo/export/context");

import * as contextMod from "@/server/neo/export/context";
import { GET } from "./route";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

const ctx = (indice: string) => ({ params: Promise.resolve({ id: "m1", indice }) });

describe("GET /api/triad3/neo/mensagens/[id]/tabelas/[indice]/csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("rejects a non-numeric table index before touching ownership", async () => {
    const response = await GET(new Request("http://localhost/x"), ctx("abc"));
    expect(response.status).toBe(400);
    expect(contextMod.loadNeoExportContext).not.toHaveBeenCalled();
  });

  it("returns 404 for a message the caller doesn't own", async () => {
    vi.mocked(contextMod.loadNeoExportContext).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), ctx("0"));
    expect(response.status).toBe(404);
  });

  it("returns CSV with a BOM and correct headers for a valid table index", async () => {
    vi.mocked(contextMod.loadNeoExportContext).mockResolvedValue({
      mensagemId: "m1",
      conversaId: "c1",
      perguntaOriginal: "pergunta",
      answer: baseNeoAnswer({
        titulo: "Relatório",
        blocos: [{ tipo: "tabela", titulo: "Dados", colunas: ["A"], linhas: [["1"]], fontesIds: [], exportavelCsv: true }],
      }),
    });
    const response = await GET(new Request("http://localhost/x"), ctx("0"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    // Read raw bytes: Response.text() decodes as UTF-8 and strips a leading BOM
    // per spec, so the BOM has to be checked on the wire bytes instead.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });
});
