import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export type NeoMensagemPapel = "usuario" | "assistente" | "sistema";
export type NeoMensagemStatus = "pendente" | "em_execucao" | "concluida" | "parcial" | "falhou" | "cancelada";

export interface NeoMensagemRow {
  id: string;
  conversaId: string;
  usuarioId: string;
  papel: NeoMensagemPapel;
  conteudo: string | null;
  respostaEstruturada: unknown;
  status: NeoMensagemStatus;
  criadoEm: string;
}

interface MensagemDbRow {
  id: string;
  conversa_id: string;
  usuario_id: string;
  papel: string;
  conteudo: string | null;
  resposta_estruturada: unknown;
  status: string;
  criado_em: string;
}

function mapMensagem(row: MensagemDbRow): NeoMensagemRow {
  return {
    id: row.id,
    conversaId: row.conversa_id,
    usuarioId: row.usuario_id,
    papel: row.papel as NeoMensagemPapel,
    conteudo: row.conteudo,
    respostaEstruturada: row.resposta_estruturada,
    status: row.status as NeoMensagemStatus,
    criadoEm: row.criado_em,
  };
}

const SELECT_COLUMNS = "id, conversa_id, usuario_id, papel, conteudo, resposta_estruturada, status, criado_em";

export async function inserirMensagem(input: {
  conversaId: string;
  usuarioId: string;
  papel: NeoMensagemPapel;
  conteudo?: string | null;
  respostaEstruturada?: unknown;
  status?: NeoMensagemStatus;
}): Promise<NeoMensagemRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_mensagens")
    .insert({
      conversa_id: input.conversaId,
      usuario_id: input.usuarioId,
      papel: input.papel,
      conteudo: input.conteudo ?? null,
      resposta_estruturada: input.respostaEstruturada ?? null,
      status: input.status ?? "concluida",
    })
    .select(SELECT_COLUMNS)
    .single<MensagemDbRow>();
  if (error || !data) throw error ?? new Error("Falha ao registrar mensagem.");
  return mapMensagem(data);
}

export async function listarMensagens(
  conversaId: string,
  options: { limit: number } = { limit: 100 },
): Promise<NeoMensagemRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_mensagens")
    .select(SELECT_COLUMNS)
    .eq("conversa_id", conversaId)
    .order("criado_em", { ascending: true })
    .limit(options.limit)
    .returns<MensagemDbRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapMensagem);
}

export async function listarUltimasMensagens(conversaId: string, quantidade: number): Promise<NeoMensagemRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_mensagens")
    .select(SELECT_COLUMNS)
    .eq("conversa_id", conversaId)
    .order("criado_em", { ascending: false })
    .limit(quantidade)
    .returns<MensagemDbRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapMensagem).reverse();
}

export async function buscarMensagemPorId(usuarioId: string, id: string): Promise<NeoMensagemRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_mensagens")
    .select(SELECT_COLUMNS)
    .eq("usuario_id", usuarioId)
    .eq("id", id)
    .maybeSingle<MensagemDbRow>();
  if (error || !data) return null;
  return mapMensagem(data);
}

export async function atualizarMensagem(
  id: string,
  patch: { conteudo?: string | null; respostaEstruturada?: unknown; status?: NeoMensagemStatus },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.conteudo !== undefined) payload.conteudo = patch.conteudo;
  if (patch.respostaEstruturada !== undefined) payload.resposta_estruturada = patch.respostaEstruturada;
  if (patch.status !== undefined) payload.status = patch.status;
  if (Object.keys(payload).length === 0) return;

  const { error } = await getSupabaseAdmin().from("neo_mensagens").update(payload).eq("id", id);
  if (error) throw error;
}
