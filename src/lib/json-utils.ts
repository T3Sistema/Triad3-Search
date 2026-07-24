export type JsonValidationResult =
  | { valid: true; value: unknown }
  | { valid: false; message: string; line?: number };

export function validateJson(raw: string): JsonValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: undefined };
  try {
    return { valid: true, value: JSON.parse(trimmed) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "JSON inválido.";
    const line = lineFromErrorMessage(message, trimmed);
    return { valid: false, message, line };
  }
}

function lineFromErrorMessage(message: string, source: string): number | undefined {
  const positionMatch = message.match(/position (\d+)/i);
  if (!positionMatch) return undefined;
  const position = Number(positionMatch[1]);
  if (Number.isNaN(position)) return undefined;
  return source.slice(0, position).split("\n").length;
}

export function formatJson(raw: string): string {
  const result = validateJson(raw);
  if (!result.valid || result.value === undefined) return raw;
  return JSON.stringify(result.value, null, 2);
}
