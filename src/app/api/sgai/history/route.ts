import { sgaiRequest } from "@/lib/scrapegraph/client";
import { jsonError, jsonOk, validationErrorResponse } from "@/lib/api-utils";
import { historyQuerySchema } from "@/lib/scrapegraph/schemas";
import type { HistoryListResponse } from "@/lib/scrapegraph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const result = await sgaiRequest<HistoryListResponse>("GET", "/history", {
    searchParams: {
      page: parsed.data.page,
      limit: parsed.data.limit,
      service: parsed.data.service,
      status: parsed.data.status,
    },
  });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
