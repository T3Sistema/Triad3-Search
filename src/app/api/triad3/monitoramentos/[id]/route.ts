import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { monitorPatchRequestSchema } from "@/lib/integration/schemas";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { MonitorResponse } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do monitor é obrigatório.");

  const result = await sgaiRequest<MonitorResponse>("GET", `/monitor/${encodeURIComponent(id)}`);
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

  const { fetchConfig, ...rest } = parsed.data;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = { ...rest, ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}) };

  const result = await sgaiRequest<MonitorResponse>("PATCH", `/monitor/${encodeURIComponent(id)}`, { body: payload });
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

  const result = await sgaiRequest("DELETE", `/monitor/${encodeURIComponent(id)}`);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data ?? { ok: true });
}
