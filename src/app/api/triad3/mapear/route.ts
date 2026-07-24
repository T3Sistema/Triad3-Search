import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { crawlRequestSchema } from "@/lib/integration/schemas";
import { iniciarMapeamento } from "@/server/services/mapear";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = crawlRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const result = await iniciarMapeamento(parsed.data);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
