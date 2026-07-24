import { jsonError, jsonOk, requireApiUser } from "@/lib/api-utils";
import { consultarCreditos } from "@/server/services/creditos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const result = await consultarCreditos();
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
