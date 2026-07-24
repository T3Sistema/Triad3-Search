import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { monitorCreateRequestSchema, monitorListQuerySchema } from "@/lib/integration/schemas";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { MonitorListResponse, MonitorResponse } from "@/server/integrations/web-intelligence/types";

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

  const result = await sgaiRequest<MonitorListResponse>("GET", "/monitor", {
    searchParams: { page: parsed.data.page, limit: parsed.data.limit, status: parsed.data.status },
  });
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

  const { name, url, interval, formats, webhookUrl, fetchConfig } = parsed.data;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = {
    name,
    url,
    interval,
    formats,
    ...(webhookUrl ? { webhookUrl } : {}),
    ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
  };

  const result = await sgaiRequest<MonitorResponse>("POST", "/monitor", { body: payload });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
