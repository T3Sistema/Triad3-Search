import { sgaiRequest } from "@/lib/scrapegraph/client";
import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import { scrapeRequestSchema } from "@/lib/scrapegraph/schemas";
import { pruneFetchConfig } from "@/lib/scrapegraph/formats";
import type { ScrapeResponse } from "@/lib/scrapegraph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = scrapeRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const { url, contentType, formats, fetchConfig } = parsed.data;
  const payload = {
    url,
    ...(contentType ? { contentType } : {}),
    formats,
    ...(pruneFetchConfig(fetchConfig) ? { fetchConfig: pruneFetchConfig(fetchConfig) } : {}),
  };

  const result = await sgaiRequest<ScrapeResponse>("POST", "/scrape", { body: payload });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
