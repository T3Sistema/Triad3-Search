import "server-only";
import { NEO_LIMITS } from "@/server/neo/limits";
import { NEO_EXECUTION_BUDGET } from "@/server/neo/budget";
import {
  atualizarExecucao,
  buscarUltimaExecucaoPorConversa,
  type NeoExecucaoRow,
  type NeoExecucaoStatus,
} from "@/server/db/repositories/neo-execucoes";
import { atualizarMensagem, buscarMensagemPorExecucaoId } from "@/server/db/repositories/neo-mensagens";
import { atualizarEtapa, listarEtapas } from "@/server/db/repositories/neo-etapas";
import { listarFontes } from "@/server/db/repositories/neo-fontes";
import { isNeoExecutionRegistered } from "@/server/neo/execution-registry";
import { buildEvidenceFallbackAnswer, hasFallbackEvidence, type FallbackEtapaLike } from "@/server/neo/fallback-answer";
import { logNeoWarn } from "@/server/neo/observability";

const ACTIVE_STATUSES: NeoExecucaoStatus[] = ["planejando", "executando", "verificando", "sintetizando", "aguardando_confirmacao"];

/**
 * How long a non-terminal execution can go without a heartbeat before
 * reconciliation treats it as orphaned. Comfortably larger than the
 * execution budget's own hard deadline (tools + synthesis reserve) plus a
 * grace period, so this never races an instance that's still legitimately
 * finishing up.
 */
const ORPHAN_THRESHOLD_MS = NEO_EXECUTION_BUDGET.totalBudgetMs + NEO_EXECUTION_BUDGET.synthesisReserveMs + NEO_LIMITS.orphanGraceMs;

const MENSAGEM_NAO_TERMINAL = new Set(["pendente", "em_execucao"]);

function isStale(execucao: NeoExecucaoRow, now: number): boolean {
  const reference = execucao.ultimoHeartbeatEm ?? execucao.iniciadoEm;
  return now - new Date(reference).getTime() > ORPHAN_THRESHOLD_MS;
}

function etapasParaEvidencia(etapas: Awaited<ReturnType<typeof listarEtapas>>): FallbackEtapaLike[] {
  return etapas
    .filter((e) => e.tipo === "ferramenta")
    .map((e) => ({
      nomePublico: e.nomePublico,
      ok: e.status === "concluida" || e.status === "parcial",
      resumo: e.resultadoResumido,
      erroPublico: e.erroPublico,
    }));
}

/**
 * Finalizes a non-terminal execution that's been abandoned by an abrupt
 * process kill (Vercel's maxDuration, a crashed instance, ...) — never
 * called for an execution genuinely still running in this process. Marks
 * any dangling step as interrupted, then classifies the execution as
 * `parcial` (usable evidence exists) or `falhou` (nothing usable), matching
 * the states the rest of the system already knows about.
 */
async function finalizeOrphanedExecution(execucao: NeoExecucaoRow): Promise<NeoExecucaoRow> {
  const etapas = await listarEtapas(execucao.id);
  const abandonadas = etapas.filter((e) => e.status === "em_execucao" || e.status === "aguardando");
  await Promise.all(
    abandonadas.map((e) =>
      atualizarEtapa(e.id, {
        status: e.tipo === "confirmacao" ? "cancelada" : "falhou",
        erroPublico: "A etapa foi interrompida antes de concluir.",
        concluidoEm: new Date().toISOString(),
      }).catch(() => {}),
    ),
  );

  const ferramentaEtapas = etapas.filter((e) => e.tipo === "ferramenta");
  const concluidasFerramentas = ferramentaEtapas.filter((e) => e.status === "concluida" || e.status === "parcial");
  const fontes = await listarFontes(execucao.id).catch(() => []);
  const evidenceLike = etapasParaEvidencia(etapas);
  const temEvidencia = hasFallbackEvidence(evidenceLike, fontes);

  const status: NeoExecucaoStatus = temEvidencia ? "parcial" : "falhou";
  const erroPublico = temEvidencia ? null : "A execução foi interrompida antes da preparação do relatório.";
  const concluidoEm = new Date().toISOString();

  await atualizarExecucao(execucao.id, {
    status,
    erroPublico,
    concluidoEm,
    totalFerramentas: concluidasFerramentas.length,
  });

  logNeoWarn("execucao.reconciliada", {
    execucaoId: execucao.id,
    motivoFinalizacao: "orfa_sem_heartbeat",
    concluidas: concluidasFerramentas.length,
    relatorio: temEvidencia ? "fallback" : undefined,
  });

  return { ...execucao, status, erroPublico, concluidoEm, totalFerramentas: concluidasFerramentas.length };
}

/**
 * Syncs the assistant message's terminal state with a (now) terminal
 * execution. Covers both the case reconciliation just finalized above, and
 * the case an execution was already terminal (e.g. fixed directly in the
 * database, or a drift left by some other code path) but its linked message
 * never reflected that — exactly the gap that kept the incident's
 * conversation stuck on "estava em andamento" even after the execution row
 * was corrected.
 */
async function syncMensagemComExecucao(execucao: NeoExecucaoRow): Promise<void> {
  const mensagem = await buscarMensagemPorExecucaoId(execucao.id);
  if (!mensagem) return;

  const mensagemNaoTerminal = MENSAGEM_NAO_TERMINAL.has(mensagem.status);
  const jaTemConteudo = Boolean(mensagem.respostaEstruturada) || Boolean(mensagem.conteudo);
  if (!mensagemNaoTerminal && jaTemConteudo) return;

  if (execucao.status === "concluida" || execucao.status === "parcial") {
    if (jaTemConteudo) {
      await atualizarMensagem(mensagem.id, { status: execucao.status }).catch(() => {});
      return;
    }
    const etapas = await listarEtapas(execucao.id);
    const fontes = await listarFontes(execucao.id).catch(() => []);
    const answer = buildEvidenceFallbackAnswer({
      motivo: execucao.erroPublico ?? "A investigação foi concluída, mas o relatório final não pôde ser recuperado.",
      etapas: etapasParaEvidencia(etapas),
      fontes,
    });
    await atualizarMensagem(mensagem.id, { status: "parcial", conteudo: answer.respostaDireta, respostaEstruturada: answer }).catch(() => {});
    return;
  }

  if (execucao.status === "falhou") {
    await atualizarMensagem(mensagem.id, {
      status: "falhou",
      conteudo: execucao.erroPublico ?? "Não foi possível concluir esta investigação.",
    }).catch(() => {});
    return;
  }

  if (execucao.status === "cancelada") {
    await atualizarMensagem(mensagem.id, { status: "cancelada", conteudo: "A execução foi interrompida." }).catch(() => {});
  }
}

/**
 * Self-heals a conversation's most recent execution. Idempotent and cheap —
 * safe to call on every read of a conversation, its messages, or a single
 * execution (see the GET routes under /api/triad3/neo/). Never touches an
 * execution genuinely still running in this same process (execution-registry.ts).
 */
export async function reconcileConversationExecution(conversaId: string): Promise<void> {
  const execucao = await buscarUltimaExecucaoPorConversa(conversaId);
  if (!execucao) return;
  if (isNeoExecutionRegistered(execucao.id)) return;

  let current = execucao;
  if (ACTIVE_STATUSES.includes(current.status)) {
    if (!isStale(current, Date.now())) return;
    current = await finalizeOrphanedExecution(current);
  }

  await syncMensagemComExecucao(current);
}
