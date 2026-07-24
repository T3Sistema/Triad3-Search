import "server-only";
import {
  registrarFalhaLogin as dbRegistrarFalhaLogin,
  registrarLoginSucesso as dbRegistrarLoginSucesso,
  selecionarUsuarioPorEmailParaLogin,
  type UsuarioParaLogin,
} from "@/server/db/repositories/usuarios";

export type { UsuarioParaLogin };

const LIMITE_TENTATIVAS_CONTA = 5;
const BLOQUEIO_CONTA_MS = 15 * 60 * 1000;

export async function buscarUsuarioParaLogin(email: string): Promise<UsuarioParaLogin | null> {
  return selecionarUsuarioPorEmailParaLogin(email);
}

export function contaTemporariamenteBloqueada(usuario: UsuarioParaLogin): boolean {
  if (!usuario.bloqueadoAte) return false;
  return new Date(usuario.bloqueadoAte).getTime() > Date.now();
}

export async function registrarLoginSucesso(id: string): Promise<void> {
  await dbRegistrarLoginSucesso(id);
}

/** Mirrors the account-level lockout columns; the rolling-window check in rate-limit.ts is the authoritative gate. */
export async function registrarFalhaLogin(usuario: UsuarioParaLogin): Promise<void> {
  const tentativas = usuario.tentativasFalhas + 1;
  const bloqueadoAte =
    tentativas >= LIMITE_TENTATIVAS_CONTA ? new Date(Date.now() + BLOQUEIO_CONTA_MS).toISOString() : usuario.bloqueadoAte;
  await dbRegistrarFalhaLogin(usuario.id, tentativas, bloqueadoAte);
}
