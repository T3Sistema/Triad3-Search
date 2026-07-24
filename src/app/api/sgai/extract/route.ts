import { sgaiRequest } from "@/lib/scrapegraph/client";
import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import { extractRequestSchema } from "@/lib/scrapegraph/schemas";
import { pruneFetchConfig } from "@/lib/scrapegraph/formats";
import type { ExtractResponse } from "@/lib/scrapegraph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = extractRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const { url, html, markdown, prompt, schema, mode, fetchConfig } = parsed.data;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = {
    ...(url ? { url } : {}),
    ...(html ? { html } : {}),
    ...(markdown ? { markdown } : {}),
    prompt,
    ...(schema ? { schema } : {}),
    ...(mode ? { mode } : {}),
    ...(url && prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
  };

  const result = await sgaiRequest<ExtractResponse>("POST", "/extract", { body: payload });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
