import { jsonOk, readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { atualizarConversaRequestSchema } from "@/lib/neo/schemas";
import { atualizarConversa, buscarConversaPorId, excluirConversa } from "@/server/db/repositories/neo-conversas";
import { neoError } from "@/server/neo/errors";
import { jsonNeoError } from "@/server/neo/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const conversa = await buscarConversaPorId(auth.user.id, id);
  if (!conversa) return jsonNeoError(neoError("not_found"));
  return jsonOk(conversa);
}

export async function PATCH(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = atualizarConversaRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }
  if (Object.keys(parsed.data).length === 0) {
    return validationErrorResponse("Informe ao menos um campo para atualizar.");
  }

  const conversa = await atualizarConversa(auth.user.id, id, parsed.data);
  if (!conversa) return jsonNeoError(neoError("not_found"));
  return jsonOk(conversa);
}

export async function DELETE(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id } = await ctx.params;
  const excluida = await excluirConversa(auth.user.id, id);
  if (!excluida) return jsonNeoError(neoError("not_found"));
  return jsonOk({ ok: true });
}
