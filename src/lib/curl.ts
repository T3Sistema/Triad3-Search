/**
 * Builds a display-only cURL command for the request preview. This always
 * targets the app's own internal route — the underlying integration and its
 * real endpoint are never revealed to the browser.
 */
export function buildCurlPreview(internalPath: string, body: unknown): string {
  const json = JSON.stringify(body, null, 2);
  const lines = [`curl -X POST "${internalPath}" \\`, `  -H "Content-Type: application/json" \\`];
  if (body !== undefined && body !== null) {
    lines.push(`  -d '${json}'`);
  }
  return lines.join("\n");
}

export function buildInternalRequestPreview(method: string, internalPath: string, body?: unknown) {
  return {
    method,
    endpoint: internalPath,
    body: body ?? null,
  };
}
