import "server-only";
import { getSupabaseAdmin } from "@/server/db/client";

export interface NovaTentativaLogin {
  emailHash: string;
  ipHash: string | null;
  sucesso: boolean;
}

export async function inserirTentativaLogin(tentativa: NovaTentativaLogin): Promise<void> {
  await getSupabaseAdmin()
    .from("tentativas_login")
    .insert({ email_hash: tentativa.emailHash, ip_hash: tentativa.ipHash, sucesso: tentativa.sucesso });
}

export async function contarFalhasRecentes(emailHash: string, desdeIso: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("tentativas_login")
    .select("id", { count: "exact", head: true })
    .eq("email_hash", emailHash)
    .eq("sucesso", false)
    .gte("criado_em", desdeIso);

  if (error || count === null) return 0;
  return count;
}
