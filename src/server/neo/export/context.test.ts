import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db/repositories/neo-mensagens");

import * as mensagensRepo from "@/server/db/repositories/neo-mensagens";
import { loadNeoExportContext, sanitizeFileNameFragment } from "./context";
import { NEO_ANSWER_VERSION } from "@/lib/neo/answer";

beforeEach(() => vi.clearAllMocks());

describe("loadNeoExportContext", () => {
  it("returns null when the message doesn't belong to the requesting user (repository already scopes by usuarioId)", async () => {
    vi.mocked(mensagensRepo.buscarMensagemPorId).mockResolvedValue(null);
    const result = await loadNeoExportContext("u1", "msg1");
    expect(result).toBeNull();
    expect(mensagensRepo.buscarMensagemPorId).toHaveBeenCalledWith("u1", "msg1");
  });

  it("returns null for a user message (only assistant reports are exportable)", async () => {
    vi.mocked(mensagensRepo.buscarMensagemPorId).mockResolvedValue({
      id: "msg1",
      conversaId: "conv1",
      usuarioId: "u1",
      papel: "usuario",
      conteudo: "pergunta",
      respostaEstruturada: null,
      status: "concluida",
      execucaoId: null,
      criadoEm: "t",
    });
    const result = await loadNeoExportContext("u1", "msg1");
    expect(result).toBeNull();
  });

  it("returns null when the message has no structured answer yet", async () => {
    vi.mocked(mensagensRepo.buscarMensagemPorId).mockResolvedValue({
      id: "msg1",
      conversaId: "conv1",
      usuarioId: "u1",
      papel: "assistente",
      conteudo: null,
      respostaEstruturada: null,
      status: "em_execucao",
      execucaoId: null,
      criadoEm: "t",
    });
    const result = await loadNeoExportContext("u1", "msg1");
    expect(result).toBeNull();
  });

  it("returns the answer and finds the preceding user question when everything is valid", async () => {
    const answer = {
      version: NEO_ANSWER_VERSION,
      status: "completo",
      titulo: "t",
      resumoExecutivo: "r",
      blocos: [],
      fontes: [],
      informacoesAusentes: [],
      observacoes: [],
      proximasAcoes: [],
      perguntaNecessaria: null,
    };
    vi.mocked(mensagensRepo.buscarMensagemPorId).mockResolvedValue({
      id: "msg2",
      conversaId: "conv1",
      usuarioId: "u1",
      papel: "assistente",
      conteudo: "resumo",
      respostaEstruturada: answer,
      status: "concluida",
      execucaoId: null,
      criadoEm: "t2",
    });
    vi.mocked(mensagensRepo.listarMensagens).mockResolvedValue([
      { id: "msg1", conversaId: "conv1", usuarioId: "u1", papel: "usuario", conteudo: "Qual a pergunta original?", respostaEstruturada: null, status: "concluida", execucaoId: null, criadoEm: "t1" },
      { id: "msg2", conversaId: "conv1", usuarioId: "u1", papel: "assistente", conteudo: "resumo", respostaEstruturada: answer, status: "concluida", execucaoId: null, criadoEm: "t2" },
    ]);
    const result = await loadNeoExportContext("u1", "msg2");
    expect(result?.perguntaOriginal).toBe("Qual a pergunta original?");
    expect(result?.answer.titulo).toBe("t");
  });
});

describe("sanitizeFileNameFragment", () => {
  it("strips accents and unsafe characters, producing a filesystem-safe fragment", () => {
    expect(sanitizeFileNameFragment("Relatório: Situação/Ação Ltda.")).toMatch(/^[a-z0-9-]+$/);
  });

  it("never allows a path traversal sequence through", () => {
    expect(sanitizeFileNameFragment("../../etc/passwd")).not.toContain("..");
    expect(sanitizeFileNameFragment("../../etc/passwd")).not.toContain("/");
  });

  it("falls back to a default when the input sanitizes to nothing", () => {
    expect(sanitizeFileNameFragment("???")).toBe("relatorio");
  });
});
