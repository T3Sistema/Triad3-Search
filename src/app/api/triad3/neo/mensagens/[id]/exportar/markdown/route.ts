import { requireApiUser } from "@/lib/api-utils";
import { jsonNeoError } from "@/server/neo/http";
import { neoError } from "@/server/neo/errors";
import { loadNeoExportContext, sanitizeFileNameFragment } from "@/server/neo/export/context";
import { renderNeoAnswerAsMarkdown } from "@/server/neo/export/markdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const context = await loadNeoExportContext(auth.user.id, id);
  if (!context) return jsonNeoError(neoError("not_found"));

  const markdown = renderNeoAnswerAsMarkdown(context.answer);
  const fileName = `neo-${sanitizeFileNameFragment(context.answer.titulo)}-${new Date().toISOString().slice(0, 10)}.md`;

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

