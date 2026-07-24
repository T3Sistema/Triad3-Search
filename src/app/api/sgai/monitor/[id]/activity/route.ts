import { sgaiRequest } from "@/lib/scrapegraph/client";
import { jsonError, jsonOk, validationErrorResponse } from "@/lib/api-utils";
import { monitorActivityQuerySchema } from "@/lib/scrapegraph/schemas";
import type { MonitorActivityResponse } from "@/lib/scrapegraph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do monitor é obrigatório.");

  const { searchParams } = new URL(request.url);
  const parsed = monitorActivityQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return validationErrorResponse("Parâmetros de paginação inválidos.", parsed.error.issues);
  }

  const result = await sgaiRequest<MonitorActivityResponse>("GET", `/monitor/${encodeURIComponent(id)}/activity`, {
    searchParams: { limit: parsed.data.limit, cursor: parsed.data.cursor },
  });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
