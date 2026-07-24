import { requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { jsonNeoError } from "@/server/neo/http";
import { neoError } from "@/server/neo/errors";
import { loadNeoExportContext, sanitizeFileNameFragment } from "@/server/neo/export/context";
import { exportNeoAnswerTableAsCsv } from "@/server/neo/export/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; indice: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id, indice: indiceRaw } = await ctx.params;
  const indice = Number(indiceRaw);
  if (!Number.isInteger(indice) || indice < 0) {
    return validationErrorResponse("Índice de tabela inválido.");
  }

  const context = await loadNeoExportContext(auth.user.id, id);
  if (!context) return jsonNeoError(neoError("not_found"));

  const result = exportNeoAnswerTableAsCsv(context.answer, indice);
  if (!result.ok) return jsonNeoError(neoError("not_found", result.erroPublico));

  const fileName = `neo-${sanitizeFileNameFragment(result.titulo)}.csv`;

  return new Response(result.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
