import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  atualizarUltimoAcesso,
  excluirSessoesExpiradas,
  inserirSessao,
  revogarSessaoPorTokenHash,
  selecionarSessaoComUsuarioPorTokenHash,
} from "@/server/db/repositories/sessoes";
import { SESSION_COOKIE_NAME, sessionDurationMs } from "@/server/auth/config";
import { sanitizeInternalPath } from "@/lib/auth/redirect-target";

export interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
}

const TOKEN_BYTES = 32;
const PATH_HEADER = "x-triad3-path";

function gerarToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export interface CriarSessaoInput {
  usuarioId: string;
  manterConectado: boolean;
  userAgent: string | null;
  ipHash: string | null;
}

/** Returns the raw token — deliver it only via the Set-Cookie header, never log it. */
export async function criarSessao(input: CriarSessaoInput): Promise<{ token: string }> {
  const token = gerarToken();
  const tokenHash = hashToken(token);
  const expiraEm = new Date(Date.now() + sessionDurationMs(input.manterConectado)).toISOString();

  await inserirSessao({
    usuarioId: input.usuarioId,
    tokenHash,
    expiraEm,
    userAgent: input.userAgent,
    ipHash: input.ipHash,
  });

  return { token };
}

async function validarTokenSessao(token: string | undefined): Promise<UsuarioPublico | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const sessao = await selecionarSessaoComUsuarioPorTokenHash(tokenHash);
  if (!sessao) return null;
  if (sessao.revogadoEm) return null;
  if (new Date(sessao.expiraEm).getTime() <= Date.now()) return null;
  if (!sessao.usuarioAtivo) return null;

  await atualizarUltimoAcesso(tokenHash).catch(() => {});

  return { id: sessao.usuarioId, nome: sessao.usuarioNome, email: sessao.usuarioEmail };
}

/** Reads the session cookie for the current request and validates it against the database. */
export async function obterSessaoAtual(): Promise<UsuarioPublico | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return validarTokenSessao(token);
}

/** For Server Component layouts/pages: redirects to /login?retorno=... when there's no valid session. */
export async function exigirUsuario(): Promise<UsuarioPublico> {
  const usuario = await obterSessaoAtual();
  if (usuario) return usuario;

  const requestHeaders = await headers();
  const pathname = sanitizeInternalPath(requestHeaders.get(PATH_HEADER), "/");
  const loginUrl = pathname === "/" ? "/login" : `/login?retorno=${encodeURIComponent(pathname)}`;
  redirect(loginUrl);
}

/** Revokes the session tied to the current request's cookie, if any. Safe to call with no session. */
export async function revogarSessao(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;
  const tokenHash = hashToken(token);
  await revogarSessaoPorTokenHash(tokenHash).catch(() => {});
}

export async function limparSessoesExpiradas(): Promise<void> {
  await excluirSessoesExpiradas();
}
