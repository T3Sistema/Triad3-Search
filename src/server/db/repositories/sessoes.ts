import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export interface NovaSessao {
  usuarioId: string;
  tokenHash: string;
  expiraEm: string;
  userAgent: string | null;
  ipHash: string | null;
}

export async function inserirSessao(sessao: NovaSessao): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("sessoes")
    .insert({
      usuario_id: sessao.usuarioId,
      token_hash: sessao.tokenHash,
      expira_em: sessao.expiraEm,
      user_agent: sessao.userAgent,
      ip_hash: sessao.ipHash,
    });
  if (error) throw error;
}

export interface SessaoComUsuario {
  usuarioId: string;
  expiraEm: string;
  revogadoEm: string | null;
  usuarioNome: string;
  usuarioEmail: string;
  usuarioAtivo: boolean;
}

interface SessaoRow {
  usuario_id: string;
  expira_em: string;
  revogado_em: string | null;
  usuarios: { nome: string; email: string; ativo: boolean } | { nome: string; email: string; ativo: boolean }[] | null;
}

export async function selecionarSessaoComUsuarioPorTokenHash(tokenHash: string): Promise<SessaoComUsuario | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("sessoes")
    .select("usuario_id, expira_em, revogado_em, usuarios(nome, email, ativo)")
    .eq("token_hash", tokenHash)
    .maybeSingle<SessaoRow>();

  if (error || !data) return null;
  const usuario = Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios;
  if (!usuario) return null;

  return {
    usuarioId: data.usuario_id,
    expiraEm: data.expira_em,
    revogadoEm: data.revogado_em,
    usuarioNome: usuario.nome,
    usuarioEmail: usuario.email,
    usuarioAtivo: usuario.ativo,
  };
}

export async function atualizarUltimoAcesso(tokenHash: string): Promise<void> {
  await getSupabaseAdmin()
    .from("sessoes")
    .update({ ultimo_acesso_em: new Date().toISOString() })
    .eq("token_hash", tokenHash);
}

export async function revogarSessaoPorTokenHash(tokenHash: string): Promise<void> {
  await getSupabaseAdmin()
    .from("sessoes")
    .update({ revogado_em: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("revogado_em", null);
}

export async function excluirSessoesExpiradas(): Promise<void> {
  await getSupabaseAdmin().from("sessoes").delete().lt("expira_em", new Date().toISOString());
}
