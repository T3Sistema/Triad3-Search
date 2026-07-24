import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-utils";
import type { CreditsResponse } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const result = await sgaiRequest<CreditsResponse>("GET", "/credits", { timeoutMs: 15_000 });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
