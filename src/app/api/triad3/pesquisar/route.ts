import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import { searchRequestSchema } from "@/lib/integration/schemas";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { SearchResponse } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = searchRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const { query, numResults, format, timeRange, locationGeoCode, prompt, schema, fetchConfig } = parsed.data;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = {
    query,
    ...(numResults ? { numResults } : {}),
    ...(format ? { format } : {}),
    ...(timeRange ? { timeRange } : {}),
    ...(locationGeoCode ? { locationGeoCode } : {}),
    ...(prompt ? { prompt } : {}),
    ...(prompt && schema ? { schema } : {}),
    ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
  };

  const result = await sgaiRequest<SearchResponse>("POST", "/search", { body: payload });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
