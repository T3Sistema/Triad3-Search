import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export interface NeoFonteRow {
  id: string;
  execucaoId: string;
  url: string;
  titulo: string | null;
  dominio: string | null;
  dataObservacao: string | null;
  metadados: unknown;
  criadoEm: string;
}

interface FonteDbRow {
  id: string;
  execucao_id: string;
  url: string;
  titulo: string | null;
  dominio: string | null;
  data_observacao: string | null;
  metadados: unknown;
  criado_em: string;
}

function mapFonte(row: FonteDbRow): NeoFonteRow {
  return {
    id: row.id,
    execucaoId: row.execucao_id,
    url: row.url,
    titulo: row.titulo,
    dominio: row.dominio,
    dataObservacao: row.data_observacao,
    metadados: row.metadados,
    criadoEm: row.criado_em,
  };
}

const SELECT_COLUMNS = "id, execucao_id, url, titulo, dominio, data_observacao, metadados, criado_em";

/** Deduplicates by (execucao_id, url) — a repeated URL updates the existing row instead of inserting a duplicate. */
export async function registrarFonte(input: {
  execucaoId: string;
  url: string;
  titulo?: string | null;
  dominio?: string | null;
  dataObservacao?: string | null;
  metadados?: unknown;
}): Promise<NeoFonteRow> {
  const normalizedUrl = input.url.trim().toLowerCase();
  const { data, error } = await getSupabaseAdmin()
    .from("neo_fontes")
    .upsert(
      {
        execucao_id: input.execucaoId,
        url: normalizedUrl,
        titulo: input.titulo ?? null,
        dominio: input.dominio ?? null,
        data_observacao: input.dataObservacao ?? null,
        metadados: input.metadados ?? null,
      },
      { onConflict: "execucao_id,url" },
    )
    .select(SELECT_COLUMNS)
    .single<FonteDbRow>();
  if (error || !data) throw error ?? new Error("Falha ao registrar fonte.");
  return mapFonte(data);
}

export async function listarFontes(execucaoId: string): Promise<NeoFonteRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("neo_fontes")
    .select(SELECT_COLUMNS)
    .eq("execucao_id", execucaoId)
    .order("criado_em", { ascending: true })
    .returns<FonteDbRow[]>();
  if (error) throw error;
  return (data ?? []).map(mapFonte);
}
