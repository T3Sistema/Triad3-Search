import { jsonOk, requireApiUser } from "@/lib/api-utils";
import { buscarConversaPorId } from "@/server/db/repositories/neo-conversas";
import { listarMensagens } from "@/server/db/repositories/neo-mensagens";
import { neoError } from "@/server/neo/errors";
import { jsonNeoError } from "@/server/neo/http";
import { reconcileConversationExecution } from "@/server/neo/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const conversa = await buscarConversaPorId(auth.user.id, id);
  if (!conversa) return jsonNeoError(neoError("not_found"));

  // Self-heals a stale "em andamento" message before the client ever sees it —
  // simply opening the conversation is enough to reflect an execution that was
  // orphaned by an abrupt process kill, no manual "Atualizar" click required.
  await reconcileConversationExecution(id).catch(() => {});

  const mensagens = await listarMensagens(id, { limit: 200 });
  return jsonOk({ data: mensagens });
}
