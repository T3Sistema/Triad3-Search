import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export interface UsuarioParaLogin {
  id: string;
  nome: string;
  email: string;
  passwordHash: string;
  ativo: boolean;
  tentativasFalhas: number;
  bloqueadoAte: string | null;
}

/** Only ever called from the login flow — the one place password_hash may be read. */
export async function selecionarUsuarioPorEmailParaLogin(email: string): Promise<UsuarioParaLogin | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("usuarios")
    .select("id, nome, email, password_hash, ativo, tentativas_falhas, bloqueado_ate")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    nome: data.nome,
    email: data.email,
    passwordHash: data.password_hash,
    ativo: data.ativo,
    tentativasFalhas: data.tentativas_falhas,
    bloqueadoAte: data.bloqueado_ate,
  };
}

export async function registrarLoginSucesso(id: string): Promise<void> {
  await getSupabaseAdmin()
    .from("usuarios")
    .update({ tentativas_falhas: 0, bloqueado_ate: null, ultimo_login_em: new Date().toISOString() })
    .eq("id", id);
}

export async function registrarFalhaLogin(
  id: string,
  tentativasFalhas: number,
  bloqueadoAte: string | null,
): Promise<void> {
  await getSupabaseAdmin()
    .from("usuarios")
    .update({ tentativas_falhas: tentativasFalhas, bloqueado_ate: bloqueadoAte })
    .eq("id", id);
}
