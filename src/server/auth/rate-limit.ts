import "server-only";
import { contarFalhasRecentes, inserirTentativaLogin } from "@/server/db/repositories/tentativas-login";

// Persistent (DB-backed, not in-memory) so the lockout survives across
// serverless invocations. Keyed by e-mail hash so it applies identically
// whether or not the e-mail belongs to a real account — this is what keeps
// the "too many attempts" response from being an account-existence oracle.
export const MAX_TENTATIVAS = 5;
export const JANELA_MS = 15 * 60 * 1000;

export interface RegistrarTentativaInput {
  emailHash: string;
  ipHash: string | null;
  sucesso: boolean;
}

export async function registrarTentativaLogin(input: RegistrarTentativaInput): Promise<void> {
  await inserirTentativaLogin(input);
}

export async function estaBloqueadoPorRateLimit(params: { emailHash: string }): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_MS).toISOString();
  const falhas = await contarFalhasRecentes(params.emailHash, desde);
  return falhas >= MAX_TENTATIVAS;
}
