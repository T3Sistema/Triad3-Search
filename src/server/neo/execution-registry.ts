import "server-only";

/**
 * In-process registry of active executions, keyed by execução id. Backs
 * cancellation (POST /api/triad3/neo/execucoes/[id]/cancelar) when the
 * cancelling request lands on the same server instance as the still-running
 * stream — the common case for this deployment shape (single Node process
 * per dev/small-scale Vercel instance).
 *
 * This is a best-effort, same-instance mechanism: `neo_execucoes.status` in
 * the database is always the source of truth for "is this cancelled", and
 * the executor also re-checks it between rounds so a cancellation recorded
 * from a different instance still stops the loop at the next checkpoint.
 */
const activeControllers = new Map<string, AbortController>();

export function registerNeoExecution(execucaoId: string, controller: AbortController): void {
  activeControllers.set(execucaoId, controller);
}

export function unregisterNeoExecution(execucaoId: string): void {
  activeControllers.delete(execucaoId);
}

export function requestNeoExecutionCancellation(execucaoId: string): boolean {
  const controller = activeControllers.get(execucaoId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/**
 * Whether this execution is genuinely still running in this same process.
 * Reconciliation (src/server/neo/reconciliation.ts) uses this to never race
 * a live stream — a non-terminal execution not in this registry is either
 * running on a different instance (leave it alone unless truly stale) or
 * really orphaned.
 */
export function isNeoExecutionRegistered(execucaoId: string): boolean {
  return activeControllers.has(execucaoId);
}
