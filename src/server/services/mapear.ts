import "server-only";
import { sgaiRequest, type SgaiResult } from "@/server/integrations/web-intelligence/client";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { CrawlRequest } from "@/lib/integration/schemas";
import type { CrawlPagesResponse, CrawlStatusResponse } from "@/server/integrations/web-intelligence/types";

/** Shared service behind the manual "Mapear site" module and the corresponding Neo tools. */
export async function iniciarMapeamento(input: CrawlRequest): Promise<SgaiResult<CrawlStatusResponse>> {
  const { url, formats, maxPages, maxDepth, maxLinksPerPage, includePatterns, excludePatterns, allowExternal, contentTypes, fetchConfig } =
    input;
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

  return sgaiRequest<CrawlStatusResponse>("POST", "/crawl", { body: payload });
}

export async function consultarMapeamento(id: string): Promise<SgaiResult<CrawlStatusResponse>> {
  return sgaiRequest<CrawlStatusResponse>("GET", `/crawl/${encodeURIComponent(id)}`);
}

export async function listarPaginasMapeamento(
  id: string,
  query: { limit: number; cursor?: string },
): Promise<SgaiResult<CrawlPagesResponse>> {
  return sgaiRequest<CrawlPagesResponse>("GET", `/crawl/${encodeURIComponent(id)}/pages`, {
    searchParams: { limit: query.limit, cursor: query.cursor },
  });
}

export async function interromperMapeamento(id: string): Promise<SgaiResult<CrawlStatusResponse>> {
  return sgaiRequest<CrawlStatusResponse>("POST", `/crawl/${encodeURIComponent(id)}/stop`);
}

export async function retomarMapeamento(id: string): Promise<SgaiResult<CrawlStatusResponse>> {
  return sgaiRequest<CrawlStatusResponse>("POST", `/crawl/${encodeURIComponent(id)}/resume`);
}

export async function excluirMapeamento(id: string): Promise<SgaiResult<unknown>> {
  return sgaiRequest("DELETE", `/crawl/${encodeURIComponent(id)}`);
}
