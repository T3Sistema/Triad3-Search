import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import type { MonitorResponse } from "@/server/integrations/web-intelligence/types";

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

  const result = await sgaiRequest<MonitorResponse>("POST", `/monitor/${encodeURIComponent(id)}/pause`);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
