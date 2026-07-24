import { readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { executarConversaRequestSchema } from "@/lib/neo/schemas";
import { buscarConversaPorId } from "@/server/db/repositories/neo-conversas";
import { neoError } from "@/server/neo/errors";
import { jsonNeoError } from "@/server/neo/http";
import { NeoEventEmitter } from "@/server/neo/events";
import { startNeoExecution, runNeoExecution } from "@/server/neo/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = Promise<{ id: string }>;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export async function POST(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id: conversaId } = await ctx.params;
  const conversa = await buscarConversaPorId(auth.user.id, conversaId);
  if (!conversa) return jsonNeoError(neoError("not_found"));

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = executarConversaRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const start = await startNeoExecution({
    usuarioId: auth.user.id,
    conversaId,
    mensagemTexto: parsed.data.mensagem,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (!start.ok) return jsonNeoError(start.error);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emitter = new NeoEventEmitter(controller);

      if (start.alreadyExists) {
        emitter.emit({ tipo: "execucao.iniciada", execucaoId: start.execucaoId, mensagemId: start.mensagemUsuarioId });
        emitter.close();
        return;
      }

      runNeoExecution({
        execucaoId: start.execucaoId,
        mensagemUsuarioId: start.mensagemUsuarioId,
        conversaId,
        usuarioId: auth.user.id,
        mensagemTexto: parsed.data.mensagem,
        emitter,
        signal: request.signal,
      }).catch(() => {
        emitter.close();
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
