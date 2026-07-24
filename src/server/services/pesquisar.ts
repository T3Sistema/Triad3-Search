import "server-only";
import { sgaiRequest, type SgaiResult } from "@/server/integrations/web-intelligence/client";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { SearchRequest } from "@/lib/integration/schemas";
import type { SearchResponse } from "@/server/integrations/web-intelligence/types";

/** Shared service behind the manual "Pesquisar" module and the corresponding Neo tool. */
export async function pesquisarWeb(input: SearchRequest): Promise<SgaiResult<SearchResponse>> {
  const { query, numResults, format, timeRange, locationGeoCode, prompt, schema, fetchConfig } = input;
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

  return sgaiRequest<SearchResponse>("POST", "/search", { body: payload });
}
