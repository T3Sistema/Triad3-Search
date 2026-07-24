/**
 * Builds a display-only cURL command for the request preview. The real
 * SGAI_API_KEY never reaches the browser, so this always shows a masked
 * placeholder — never a real secret.
 */
export function buildCurlPreview(externalPath: string, body: unknown, baseUrl = "https://v2-api.scrapegraphai.com"): string {
  const url = `${baseUrl}/api${externalPath}`;
  const json = JSON.stringify(body, null, 2);
  return [
    `curl -X POST "${url}" \\`,
    `  -H "SGAI-APIKEY: $SGAI_API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${json}'`,
  ].join("\n");
}

export function buildInternalRequestPreview(method: string, internalPath: string, body?: unknown) {
  return {
    method,
    endpoint: internalPath,
    body: body ?? null,
  };
}
