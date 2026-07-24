import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { monitorPatchRequestSchema } from "@/lib/integration/schemas";
import { atualizarMonitoramento, consultarMonitoramento, excluirMonitoramento } from "@/server/services/monitorar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do monitor é obrigatório.");

  const result = await consultarMonitoramento(id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}

export async function PATCH(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do monitor é obrigatório.");

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = monitorPatchRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }
  if (Object.keys(parsed.data).length === 0) {
    return validationErrorResponse("Informe ao menos um campo para atualizar.");
  }

  const result = await atualizarMonitoramento(id, parsed.data);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}

export async function DELETE(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do monitor é obrigatório.");

  const result = await excluirMonitoramento(id);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data ?? { ok: true });
}
