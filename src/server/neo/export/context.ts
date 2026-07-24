import "server-only";
import { buscarMensagemPorId, listarMensagens } from "@/server/db/repositories/neo-mensagens";
import { normalizeNeoAnswer, type NeoAnswer } from "@/lib/neo/answer";

export interface NeoExportContext {
  mensagemId: string;
  conversaId: string;
  answer: NeoAnswer;
  perguntaOriginal: string;
}

/**
 * Loads a finished Neo answer for export (PDF/Markdown/CSV), enforcing
 * ownership and that the message actually holds a valid structured answer.
 * Returns null when the message doesn't exist, doesn't belong to the
 * caller, or has no exportable report yet.
 */
export async function loadNeoExportContext(usuarioId: string, mensagemId: string): Promise<NeoExportContext | null> {
  const mensagem = await buscarMensagemPorId(usuarioId, mensagemId);
  if (!mensagem || mensagem.papel !== "assistente" || !mensagem.respostaEstruturada) return null;

  const answer = normalizeNeoAnswer(mensagem.respostaEstruturada);

  const historico = await listarMensagens(mensagem.conversaId, { limit: 500 });
  const index = historico.findIndex((m) => m.id === mensagemId);
  const perguntaOriginal =
    [...historico.slice(0, index === -1 ? historico.length : index)].reverse().find((m) => m.papel === "usuario")?.conteudo ??
    "Não disponível.";

  return { mensagemId, conversaId: mensagem.conversaId, answer, perguntaOriginal };
}

/** Sanitizes a report title into a safe filename fragment (no path separators, no control chars). */
export function sanitizeFileNameFragment(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 80) || "relatorio"
  );
}
