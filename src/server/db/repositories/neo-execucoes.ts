import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export type NeoExecucaoStatus =
  | "planejando"
  | "executando"
  | "verificando"
  | "sintetizando"
  | "aguardando_confirmacao"
  | "concluida"
  | "parcial"
  | "falhou"
  | "cancelada";

const ACTIVE_STATUSES: NeoExecucaoStatus[] = [
  "planejando",
  "executando",
  "verificando",
  "sintetizando",
  "aguardando_confirmacao",
];

export interface NeoExecucaoRow {
  id: string;
  conversaId: string;
  mensagemUsuarioId: string;
  usuarioId: string;
  status: NeoExecucaoStatus;
  plano: unknown;
  camposSolicitados: unknown;
  camposEncontrados: unknown;
  camposAusentes: unknown;
  erroPublico: string | null;
  idempotencyKey: string | null;
  contextoPendente: unknown;
  iniciadoEm: string;
  concluidoEm: string | null;
  canceladoEm: string | null;
  totalFerramentas: number;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  ultimoHeartbeatEm: string | null;
}

interface ExecucaoDbRow {
  id: string;
  conversa_id: string;
  mensagem_usuario_id: string;
  usuario_id: string;
  status: string;
  plano: unknown;
  campos_solicitados: unknown;
  campos_encontrados: unknown;
  campos_ausentes: unknown;
  erro_publico: string | null;
  idempotency_key: string | null;
  contexto_pendente: unknown;
  iniciado_em: string;
  concluido_em: string | null;
  cancelado_em: string | null;
  total_ferramentas: number;
  tokens_entrada: number | null;
  tokens_saida: number | null;
  ultimo_heartbeat_em: string | null;
}

function mapExecucao(row: ExecucaoDbRow): NeoExecucaoRow {
  return {
    id: row.id,
    conversaId: row.conversa_id,
    mensagemUsuarioId: row.mensagem_usuario_id,
    usuarioId: row.usuario_id,
    status: row.status as NeoExecucaoStatus,
    plano: row.plano,
    camposSolicitados: row.campos_solicitados,
    camposEncontrados: row.campos_encontrados,
    camposAusentes: row.campos_ausentes,
    erroPublico: row.erro_publico,
    idempotencyKey: row.idempotency_key,
    contextoPendente: row.contexto_pendente,
    iniciadoEm: row.iniciado_em,
    concluidoEm: row.concluido_em,
    canceladoEm: row.cancelado_em,
    totalFerramentas: row.total_ferramentas,
    tokensEntrada: row.tokens_entrada,
    tokensSaida: row.tokens_saida,
    ultimoHeartbeatEm: row.ultimo_heartbeat_em,
  };
}

const SELECT_COLUMNS =
  "id, conversa_id, mensagem_usuario_id, usuario_id, status, plano, campos_solicitados, campos_encontrados, campos_ausentes, erro_publico, idempotency_key, contexto_pendente, iniciado_em, concluido_em, cancelado_em, total_ferramentas, tokens_entrada, tokens_saida, ultimo_heartbeat_em";

export async function criarExecucao(input: {
  conversaId: string;
  mensagemUsuarioId: string;
  usuarioId: string;
  idempotencyKey?: string | null;
}): Promise<NeoExecucaoRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_execucoes")
    .insert({
      conversa_id: input.conversaId,
      mensagem_usuario_id: input.mensagemUsuarioId,
      usuario_id: input.usuarioId,
      status: "planejando",
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select(SELECT_COLUMNS)
    .single<ExecucaoDbRow>();
  if (error || !data) throw error ?? new Error("Falha ao criar execução.");
  return mapExecucao(data);
}

export async function buscarExecucaoPorIdempotencyKey(
  conversaId: string,
  idempotencyKey: string,
): Promise<NeoExecucaoRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_execucoes")
    .select(SELECT_COLUMNS)
    .eq("conversa_id", conversaId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<ExecucaoDbRow>();
  if (error || !data) return null;
  return mapExecucao(data);
}

export async function buscarExecucaoAtivaPorConversa(conversaId: string): Promise<NeoExecucaoRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_execucoes")
    .select(SELECT_COLUMNS)
    .eq("conversa_id", conversaId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle<ExecucaoDbRow>();
  if (error || !data) return null;
  return mapExecucao(data);
}

export async function contarExecucoesAtivasPorUsuario(usuarioId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("neo_execucoes")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId)
    .in("status", ACTIVE_STATUSES);
  if (error) throw error;
  return count ?? 0;
}

export async function buscarExecucaoPorId(usuarioId: string, id: string): Promise<NeoExecucaoRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_execucoes")
    .select(SELECT_COLUMNS)
    .eq("usuario_id", usuarioId)
    .eq("id", id)
    .maybeSingle<ExecucaoDbRow>();
  if (error || !data) return null;
  return mapExecucao(data);
}

export interface AtualizarExecucaoPatch {
  status?: NeoExecucaoStatus;
  plano?: unknown;
  camposSolicitados?: unknown;
  camposEncontrados?: unknown;
  camposAusentes?: unknown;
  erroPublico?: string | null;
  contextoPendente?: unknown;
  concluidoEm?: string | null;
  canceladoEm?: string | null;
  totalFerramentas?: number;
  tokensEntrada?: number | null;
  tokensSaida?: number | null;
  ultimoHeartbeatEm?: string | null;
}

export async function atualizarExecucao(id: string, patch: AtualizarExecucaoPatch): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.plano !== undefined) payload.plano = patch.plano;
  if (patch.camposSolicitados !== undefined) payload.campos_solicitados = patch.camposSolicitados;
  if (patch.camposEncontrados !== undefined) payload.campos_encontrados = patch.camposEncontrados;
  if (patch.camposAusentes !== undefined) payload.campos_ausentes = patch.camposAusentes;
  if (patch.erroPublico !== undefined) payload.erro_publico = patch.erroPublico;
  if (patch.contextoPendente !== undefined) payload.contexto_pendente = patch.contextoPendente;
  if (patch.concluidoEm !== undefined) payload.concluido_em = patch.concluidoEm;
  if (patch.canceladoEm !== undefined) payload.cancelado_em = patch.canceladoEm;
  if (patch.totalFerramentas !== undefined) payload.total_ferramentas = patch.totalFerramentas;
  if (patch.tokensEntrada !== undefined) payload.tokens_entrada = patch.tokensEntrada;
  if (patch.tokensSaida !== undefined) payload.tokens_saida = patch.tokensSaida;
  if (patch.ultimoHeartbeatEm !== undefined) payload.ultimo_heartbeat_em = patch.ultimoHeartbeatEm;
  if (Object.keys(payload).length === 0) return;

  const { error } = await getSupabaseAdmin().from("neo_execucoes").update(payload).eq("id", id);
  if (error) throw error;
}

/**
 * Most recent execution for a conversation, regardless of status — used by
 * reconciliation to notice a terminal execução whose linked mensagem row
 * never got synced (e.g. the orchestrator process died before it could run
 * finishWithAnswer/failExecution), not just currently-active ones.
 */
export async function buscarUltimaExecucaoPorConversa(conversaId: string): Promise<NeoExecucaoRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_execucoes")
    .select(SELECT_COLUMNS)
    .eq("conversa_id", conversaId)
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle<ExecucaoDbRow>();
  if (error || !data) return null;
  return mapExecucao(data);
}
