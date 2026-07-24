import "server-only";

// Server-side equivalent of src/lib/ui/formatting.ts (which is "use client"-only)
// for exports rendered on the server (PDF).
const formatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatDateTimePtBr(value: Date): string {
  return formatter.format(value);
}
