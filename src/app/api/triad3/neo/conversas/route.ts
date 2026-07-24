import { jsonOk, readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { criarConversaRequestSchema, listarConversasQuerySchema } from "@/lib/neo/schemas";
import { criarConversa, listarConversas } from "@/server/db/repositories/neo-conversas";
import { neoError } from "@/server/neo/errors";
import { jsonNeoError } from "@/server/neo/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const parsed = listarConversasQuerySchema.safeParse({
    busca: searchParams.get("busca") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return validationErrorResponse("Parâmetros de listagem inválidos.", parsed.error.issues);
  }

  try {
    const conversas = await listarConversas(auth.user.id, parsed.data);
    return jsonOk({ data: conversas });
  } catch {
    return jsonNeoError(neoError("unknown"));
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = criarConversaRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  try {
    const conversa = await criarConversa({ usuarioId: auth.user.id, titulo: parsed.data.titulo ?? "Nova conversa" });
    return jsonOk(conversa, 201);
  } catch {
    return jsonNeoError(neoError("unknown"));
  }
}
