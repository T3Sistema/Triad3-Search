import { readJsonBody, rejectUntrustedOrigin, requireApiUser, validationErrorResponse } from "@/lib/api-utils";
import { confirmarExecucaoRequestSchema } from "@/lib/neo/schemas";
import { buscarExecucaoPorId } from "@/server/db/repositories/neo-execucoes";
import { neoError } from "@/server/neo/errors";
import { jsonNeoError } from "@/server/neo/http";
import { NeoEventEmitter } from "@/server/neo/events";
import { resumeNeoExecutionAfterConfirmation } from "@/server/neo/orchestrator";

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

/**
 * Executes (or rejects) a persistent action Neo already asked to confirm.
 * The confirmed arguments are never re-read from the client — they were
 * already validated and stored server-side when the pause happened (see
 * neo_execucoes.contexto_pendente in orchestrator.ts). This route only ever
 * accepts a yes/no.
 */
export async function POST(request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const originRejection = rejectUntrustedOrigin(request);
  if (originRejection) return originRejection;

  const { id: execucaoId } = await ctx.params;
  const execucao = await buscarExecucaoPorId(auth.user.id, execucaoId);
  if (!execucao) return jsonNeoError(neoError("not_found"));
  if (execucao.status !== "aguardando_confirmacao") {
    return jsonNeoError(neoError("validation", "Esta execução não está aguardando confirmação."));
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;

  const parsed = confirmarExecucaoRequestSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return validationErrorResponse("Confira os campos enviados.", parsed.error.issues);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emitter = new NeoEventEmitter(controller);
      resumeNeoExecutionAfterConfirmation({
        usuarioId: auth.user.id,
        conversaId: execucao.conversaId,
        execucaoId,
        confirmado: parsed.data.confirmar,
        emitter,
        signal: request.signal,
      }).catch(() => {
        emitter.close();
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
