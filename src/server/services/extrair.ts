import "server-only";
import { sgaiRequest, type SgaiResult } from "@/server/integrations/web-intelligence/client";
import { pruneFetchConfig } from "@/lib/integration/formats";
import type { ExtractRequest } from "@/lib/integration/schemas";
import type { ExtractResponse } from "@/server/integrations/web-intelligence/types";

/** Shared service behind the manual "Extrair" module and the corresponding Neo tool. */
export async function extrairDados(input: ExtractRequest): Promise<SgaiResult<ExtractResponse>> {
  const { url, html, markdown, prompt, schema, mode, fetchConfig } = input;
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

  return sgaiRequest<ExtractResponse>("POST", "/extract", { body: payload });
}
