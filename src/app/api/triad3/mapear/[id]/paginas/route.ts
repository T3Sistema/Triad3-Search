import { sgaiRequest } from "@/server/integrations/web-intelligence/client";
import { jsonError, jsonOk, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { crawlPagesQuerySchema } from "@/lib/integration/schemas";
import type { CrawlPagesResponse } from "@/server/integrations/web-intelligence/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id) return validationErrorResponse("ID do crawl é obrigatório.");

  const { searchParams } = new URL(request.url);
  const parsed = crawlPagesQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return validationErrorResponse("Parâmetros de paginação inválidos.", parsed.error.issues);
  }

  const result = await sgaiRequest<CrawlPagesResponse>("GET", `/crawl/${encodeURIComponent(id)}/pages`, {
    searchParams: { limit: parsed.data.limit, cursor: parsed.data.cursor },
  });
  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data);
}
