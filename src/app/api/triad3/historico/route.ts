import { jsonError, jsonOk, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { historyQuerySchema } from "@/lib/integration/schemas";
import { listarHistorico } from "@/server/services/historico";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    service: searchParams.get("service") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return validationErrorResponse("Parâmetros de listagem inválidos.", parsed.error.issues);
  }

  const result = await listarHistorico(parsed.data);
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
