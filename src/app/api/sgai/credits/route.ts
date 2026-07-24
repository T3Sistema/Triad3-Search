import { sgaiRequest } from "@/lib/scrapegraph/client";
import { jsonError, jsonOk } from "@/lib/api-utils";
import type { CreditsResponse } from "@/lib/scrapegraph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await sgaiRequest<CreditsResponse>("GET", "/credits", { timeoutMs: 15_000 });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
