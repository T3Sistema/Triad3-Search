import "server-only";
import { sgaiRequest, type SgaiResult } from "@/server/integrations/web-intelligence/client";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { ScrapeRequest } from "@/lib/integration/schemas";
import type { ScrapeResponse } from "@/server/integrations/web-intelligence/types";

/**
 * Shared service behind the manual "Capturar" module and the corresponding
 * Neo tool. Both the route handler (src/app/api/triad3/capturar/route.ts)
 * and the orchestrator call this function directly — never through an
 * internal HTTP hop.
 */
export async function capturarPagina(input: ScrapeRequest): Promise<SgaiResult<ScrapeResponse>> {
  const { url, contentType, formats, fetchConfig } = input;
  const prunedFetchConfig = pruneFetchConfig(fetchConfig);
  const payload = {
    url,
    ...(contentType ? { contentType } : {}),
    formats,
    ...(prunedFetchConfig ? { fetchConfig: prunedFetchConfig } : {}),
  };

  return sgaiRequest<ScrapeResponse>("POST", "/scrape", { body: payload });
}
