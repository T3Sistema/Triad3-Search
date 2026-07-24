import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, readJsonBody, rejectUntrustedOrigin, validationErrorResponse } from "@/lib/api-utils";
import { crawlRequestSchema } from "@/lib/integration/schemas";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { CrawlStatusResponse } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = crawlRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const { url, formats, maxPages, maxDepth, maxLinksPerPage, includePatterns, excludePatterns, allowExternal, contentTypes, fetchConfig } =
    parsed.data;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = {
    url,
    formats,
    maxPages,
    maxDepth,
    maxLinksPerPage,
    ...(includePatterns && includePatterns.length > 0 ? { includePatterns } : {}),
    ...(excludePatterns && excludePatterns.length > 0 ? { excludePatterns } : {}),
    allowExternal,
    ...(contentTypes && contentTypes.length > 0 ? { contentTypes } : {}),
    ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
  };

  const result = await sgaiRequest<CrawlStatusResponse>("POST", "/crawl", { body: payload });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
