import { requireApiUser } from "@/lib/api-utils";
import { jsonNeoError } from "@/server/neo/http";
import { neoError } from "@/server/neo/errors";
import { loadNeoExportContext, sanitizeFileNameFragment } from "@/server/neo/export/context";
import { renderNeoAnswerPdf } from "@/server/neo/export/pdf";
import { formatDateTimePtBr } from "@/server/neo/export/format-date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const context = await loadNeoExportContext(auth.user.id, id);
  if (!context) return jsonNeoError(neoError("not_found"));

  let buffer: Buffer;
  try {
    buffer = await renderNeoAnswerPdf(context.answer, {
      perguntaOriginal: context.perguntaOriginal,
      usuarioNome: auth.user.nome,
      geradoEm: formatDateTimePtBr(new Date()),
    });
  } catch {
    return jsonNeoError(neoError("unknown", "Não foi possível gerar o PDF deste relatório."));
  }

  const fileName = `neo-${sanitizeFileNameFragment(context.answer.titulo)}-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
