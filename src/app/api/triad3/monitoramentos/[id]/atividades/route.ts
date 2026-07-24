import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { monitorActivityQuerySchema } from "@/lib/integration/schemas";
import type { MonitorActivityResponse } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

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
