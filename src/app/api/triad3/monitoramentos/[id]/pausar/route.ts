import { jsonError, jsonOk, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { pausarMonitoramento } from "@/server/services/monitorar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do monitor é obrigatório.");

  const result = await pausarMonitoramento(id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
