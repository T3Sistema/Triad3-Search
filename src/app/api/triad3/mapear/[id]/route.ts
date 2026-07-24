import { jsonError, jsonOk, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { consultarMapeamento, excluirMapeamento } from "@/server/services/mapear";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do crawl é obrigatório.");

  const result = await consultarMapeamento(id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}

export async function DELETE(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do crawl é obrigatório.");

  const result = await excluirMapeamento(id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data ?? { ok: true });
}
