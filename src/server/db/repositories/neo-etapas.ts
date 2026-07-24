import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export type NeoEtapaTipo = "ferramenta" | "confirmacao" | "verificacao" | "sintese";
export type NeoEtapaStatus = "aguardando" | "em_execucao" | "concluida" | "parcial" | "falhou" | "cancelada";

export interface NeoEtapaRow {
  id: string;
  execucaoId: string;
  ordem: number;
  tipo: NeoEtapaTipo;
  nomePublico: string;
  ferramentaInterna: string | null;
  status: NeoEtapaStatus;
  argumentosSanitizados: unknown;
  resultadoResumido: unknown;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  erroPublico: string | null;
}

interface EtapaDbRow {
  id: string;
  execucao_id: string;
  ordem: number;
  tipo: string;
  nome_publico: string;
  ferramenta_interna: string | null;
  status: string;
  argumentos_sanitizados: unknown;
  resultado_resumido: unknown;
  iniciado_em: string | null;
  concluido_em: string | null;
  erro_publico: string | null;
}

function mapEtapa(row: EtapaDbRow): NeoEtapaRow {
  return {
    id: row.id,
    execucaoId: row.execucao_id,
    ordem: row.ordem,
    tipo: row.tipo as NeoEtapaTipo,
    nomePublico: row.nome_publico,
    ferramentaInterna: row.ferramenta_interna,
    status: row.status as NeoEtapaStatus,
    argumentosSanitizados: row.argumentos_sanitizados,
    resultadoResumido: row.resultado_resumido,
    iniciadoEm: row.iniciado_em,
    concluidoEm: row.concluido_em,
    erroPublico: row.erro_publico,
  };
}

const SELECT_COLUMNS =
  "id, execucao_id, ordem, tipo, nome_publico, ferramenta_interna, status, argumentos_sanitizados, resultado_resumido, iniciado_em, concluido_em, erro_publico";

export async function inserirEtapa(input: {
  execucaoId: string;
  ordem: number;
  tipo: NeoEtapaTipo;
  nomePublico: string;
  ferramentaInterna?: string | null;
  status: NeoEtapaStatus;
  argumentosSanitizados?: unknown;
}): Promise<NeoEtapaRow> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_etapas")
    .insert({
      execucao_id: input.execucaoId,
      ordem: input.ordem,
      tipo: input.tipo,
      nome_publico: input.nomePublico,
      ferramenta_interna: input.ferramentaInterna ?? null,
      status: input.status,
      argumentos_sanitizados: input.argumentosSanitizados ?? null,
      iniciado_em: input.status === "em_execucao" ? new Date().toISOString() : null,
    })
    .select(SELECT_COLUMNS)
    .single<EtapaDbRow>();
  if (error || !data) throw error ?? new Error("Falha ao registrar etapa.");
  return mapEtapa(data);
}

export async function atualizarEtapa(
  id: string,
  patch: {
    status?: NeoEtapaStatus;
    resultadoResumido?: unknown;
    erroPublico?: string | null;
    concluidoEm?: string | null;
    iniciadoEm?: string | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.resultadoResumido !== undefined) payload.resultado_resumido = patch.resultadoResumido;
  if (patch.erroPublico !== undefined) payload.erro_publico = patch.erroPublico;
  if (patch.concluidoEm !== undefined) payload.concluido_em = patch.concluidoEm;
  if (patch.iniciadoEm !== undefined) payload.iniciado_em = patch.iniciadoEm;
  if (Object.keys(payload).length === 0) return;

  const { error } = await getSupabaseAdmin().from("neo_etapas").update(payload).eq("id", id);
  if (error) throw error;
}

export async function listarEtapas(execucaoId: string): Promise<NeoEtapaRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_etapas")
    .select(SELECT_COLUMNS)
    .eq("execucao_id", execucaoId)
    .order("ordem", { ascending: true })
    .returns<EtapaDbRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapEtapa);
}
