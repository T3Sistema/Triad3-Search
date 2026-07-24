import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { monitorCreateRequestSchema, monitorListQuerySchema } from "@/lib/integration/schemas";
import { criarMonitoramento, listarMonitoramentos } from "@/server/services/monitorar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = monitorListQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return validationErrorResponse("Parâmetros de listagem inválidos.", parsed.error.issues);
  }

  const result = await listarMonitoramentos(parsed.data);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = monitorCreateRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const result = await criarMonitoramento(parsed.data);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
