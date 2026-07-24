import { jsonOk, requireApiUser } from "@/lib/api-utils";
import { buscarConversaPorId } from "@/server/db/repositories/neo-conversas";
import { listarMensagens } from "@/server/db/repositories/neo-mensagens";
import { neoError } from "@/server/neo/errors";
import { jsonNeoError } from "@/server/neo/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const conversa = await buscarConversaPorId(auth.user.id, id);
  if (!conversa) return jsonNeoError(neoError("not_found"));

  const mensagens = await listarMensagens(id, { limit: 200 });
  return jsonOk({ data: mensagens });
}
