import { jsonOk, rejectUntrustedOrigin, requireApiUser } from "@/lib/api-utils";
import { jsonNeoError } from "@/server/neo/http";
import { cancelNeoExecution } from "@/server/neo/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  const result = await cancelNeoExecution(auth.user.id, id);
  if (!result.ok) return jsonNeoError(result.error);
  return jsonOk({ ok: true, jaFinalizada: result.jaFinalizada });
}
