import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import type { CrawlStatusResponse } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do crawl é obrigatório.");

  const result = await sgaiRequest<CrawlStatusResponse>("GET", `/crawl/${encodeURIComponent(id)}`);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}

export async function DELETE(request: Request, ctx: { params: Params }) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do crawl é obrigatório.");

  const result = await sgaiRequest("DELETE", `/crawl/${encodeURIComponent(id)}`);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data ?? { ok: true });
}
