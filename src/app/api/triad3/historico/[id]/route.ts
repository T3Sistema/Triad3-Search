import { jsonError, jsonOk, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { consultarHistorico } from "@/server/services/historico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do item de histórico é obrigatório.");

  const result = await consultarHistorico(id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
