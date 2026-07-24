import { sgaiRequest } from "@/lib/scrapegraph/client";
import { jsonError, jsonOk, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import type { MonitorResponse } from "@/lib/scrapegraph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, ctx: { params: Params }) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do monitor é obrigatório.");

  const result = await sgaiRequest<MonitorResponse>("POST", `/monitor/${encodeURIComponent(id)}/resume`);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
