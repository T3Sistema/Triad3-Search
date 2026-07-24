import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export type NeoConversaStatus = "ativa" | "arquivada";

export interface NeoConversaRow {
  id: string;
  usuarioId: string;
  titulo: string;
  resumoContexto: string | null;
  status: NeoConversaStatus;
  criadoEm: string;
  atualizadoEm: string;
}

interface ConversaDbRow {
  id: string;
  usuario_id: string;
  titulo: string;
  resumo_contexto: string | null;
  status: string;
  criado_em: string;
  atualizado_em: string;
}

function mapConversa(row: ConversaDbRow): NeoConversaRow {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    titulo: row.titulo,
    resumoContexto: row.resumo_contexto,
    status: row.status as NeoConversaStatus,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

const SELECT_COLUMNS = "id, usuario_id, titulo, resumo_contexto, status, criado_em, atualizado_em";

export async function criarConversa(input: { usuarioId: string; titulo: string }): Promise<NeoConversaRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_conversas")
    .insert({ usuario_id: input.usuarioId, titulo: input.titulo })
    .select(SELECT_COLUMNS)
    .single<ConversaDbRow>();
  if (error || !data) throw error ?? new Error("Falha ao criar conversa.");
  return mapConversa(data);
}

export async function listarConversas(
  usuarioId: string,
  options: { limit: number; busca?: string },
): Promise<NeoConversaRow[]> {
  let query = getSupabaseAdmin()
    .from("neo_conversas")
    .select(SELECT_COLUMNS)
    .eq("usuario_id", usuarioId)
    .is("excluido_em", null)
    .order("atualizado_em", { ascending: false })
    .limit(options.limit);

  if (options.busca) {
    query = query.ilike("titulo", `%${options.busca}%`);
  }

  const { data, error } = await query.returns<ConversaDbRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapConversa);
}

export async function buscarConversaPorId(usuarioId: string, id: string): Promise<NeoConversaRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_conversas")
    .select(SELECT_COLUMNS)
    .eq("usuario_id", usuarioId)
    .eq("id", id)
    .is("excluido_em", null)
    .maybeSingle<ConversaDbRow>();
  if (error || !data) return null;
  return mapConversa(data);
}

export async function atualizarConversa(
  usuarioId: string,
  id: string,
  patch: { titulo?: string; resumoContexto?: string; status?: NeoConversaStatus },
): Promise<NeoConversaRow | null> {
  const payload: Record<string, unknown> = {};
  if (patch.titulo !== undefined) payload.titulo = patch.titulo;
  if (patch.resumoContexto !== undefined) payload.resumo_contexto = patch.resumoContexto;
  if (patch.status !== undefined) payload.status = patch.status;

  const { data, error } = await getSupabaseAdmin()
    .from("neo_conversas")
    .update(payload)
    .eq("usuario_id", usuarioId)
    .eq("id", id)
    .is("excluido_em", null)
    .select(SELECT_COLUMNS)
    .maybeSingle<ConversaDbRow>();
  if (error || !data) return null;
  return mapConversa(data);
}

export async function tocarConversa(id: string): Promise<void> {
  await getSupabaseAdmin().from("neo_conversas").update({ atualizado_em: new Date().toISOString() }).eq("id", id);
}

export async function excluirConversa(usuarioId: string, id: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_conversas")
    .update({ excluido_em: new Date().toISOString() })
    .eq("usuario_id", usuarioId)
    .eq("id", id)
    .is("excluido_em", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
