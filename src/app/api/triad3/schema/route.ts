import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import { schemaGenRequestSchema } from "@/lib/integration/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional AI schema generator. Not every backing integration plan/version
 * exposes this endpoint — a 404 here is expected and handled gracefully by
 * the client (manual schema editing keeps working either way).
 */
export async function POST(request: Request) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = schemaGenRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const result = await sgaiRequest("POST", "/schema", { body: parsed.data, timeoutMs: 30_000 });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
