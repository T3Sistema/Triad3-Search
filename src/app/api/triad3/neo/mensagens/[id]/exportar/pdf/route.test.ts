import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, requireApiUser: () => requireApiUser() };
});
vi.mock("@/server/neo/export/context");
vi.mock("@/server/neo/export/pdf");

import * as contextMod from "@/server/neo/export/context";
import * as pdfMod from "@/server/neo/export/pdf";
import { GET } from "./route";
import { baseNeoAnswer } from "@/lib/neo/answer-fixtures";

const ctx = { params: Promise.resolve({ id: "m1" }) };

describe("GET /api/triad3/neo/mensagens/[id]/exportar/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUser.mockResolvedValue({ ok: true, user: { id: "u1", nome: "Ana", email: "ana@triad3.com" } });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 404 when the message doesn't belong to the caller, without rendering a PDF", async () => {
    vi.mocked(contextMod.loadNeoExportContext).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/x"), ctx);
    expect(response.status).toBe(404);
    expect(pdfMod.renderNeoAnswerPdf).not.toHaveBeenCalled();
  });

  it("returns an attachment PDF with correct headers on success", async () => {
    vi.mocked(contextMod.loadNeoExportContext).mockResolvedValue({
      mensagemId: "m1",
      conversaId: "c1",
      perguntaOriginal: "pergunta",
      answer: baseNeoAnswer({ titulo: "Relatório", respostaDireta: "resumo" }),
    });
    vi.mocked(pdfMod.renderNeoAnswerPdf).mockResolvedValue(Buffer.from("%PDF-fake"));
    const response = await GET(new Request("http://localhost/x"), ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });

  it("returns a handled error (never a raw stack trace) when PDF rendering throws", async () => {
    vi.mocked(contextMod.loadNeoExportContext).mockResolvedValue({
      mensagemId: "m1",
      conversaId: "c1",
      perguntaOriginal: "pergunta",
      answer: baseNeoAnswer({ titulo: "Relatório", respostaDireta: "resumo" }),
    });
    vi.mocked(pdfMod.renderNeoAnswerPdf).mockRejectedValue(new Error("internal renderer failure with a stack trace"));
    const response = await GET(new Request("http://localhost/x"), ctx);
    const body = await response.text();
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(body).not.toContain("stack trace");
  });
});
