/** Normalizes the loosely-typed `results.<format>.data` field for rendering. */
export function asText(data: unknown): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n\n");
  if (typeof data === "object") return JSON.stringify(data, null, 2);
  return String(data);
}

export function asStringArray(data: unknown): string[] {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter((item): item is string => typeof item === "string");
  if (typeof data === "string") return [data];
  return [];
}

export function asScreenshotUrl(data: unknown): string | undefined {
  if (!data) return undefined;
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null && "url" in data) {
    const url = (data as { url?: unknown }).url;
    return typeof url === "string" ? url : undefined;
  }
  return undefined;
}
