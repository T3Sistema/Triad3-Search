import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, validationErrorResponse } from "@/lib/api-utils";
import type { HistoryItem } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do item de histórico é obrigatório.");

  const result = await sgaiRequest<HistoryItem>("GET", `/history/${encodeURIComponent(id)}`);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
