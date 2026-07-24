import { jsonOk, requireApiUser } from "@/lib/api-utils";
import { buscarExecucaoPorId } from "@/server/db/repositories/neo-execucoes";
import { listarEtapas } from "@/server/db/repositories/neo-etapas";
import { neoError } from "@/server/neo/errors";
import { jsonNeoError } from "@/server/neo/http";
import { reconcileConversationExecution } from "@/server/neo/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, ctx: { params: Params }) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let execucao = await buscarExecucaoPorId(auth.user.id, id);
  if (!execucao) return jsonNeoError(neoError("not_found"));

  await reconcileConversationExecution(execucao.conversaId).catch(() => {});
  execucao = (await buscarExecucaoPorId(auth.user.id, id)) ?? execucao;

  const etapas = await listarEtapas(id);
  return jsonOk({
    id: execucao.id,
    conversaId: execucao.conversaId,
    status: execucao.status,
    camposSolicitados: execucao.camposSolicitados,
    camposEncontrados: execucao.camposEncontrados,
    camposAusentes: execucao.camposAusentes,
    erroPublico: execucao.erroPublico,
    iniciadoEm: execucao.iniciadoEm,
    concluidoEm: execucao.concluidoEm,
    canceladoEm: execucao.canceladoEm,
    etapas: etapas.map((e) => ({
      id: e.id,
      ordem: e.ordem,
      tipo: e.tipo,
      nomePublico: e.nomePublico,
      status: e.status,
      erroPublico: e.erroPublico,
    })),
  });
}
