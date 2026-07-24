import "server-only";

/**
 * Central, testable wall-clock budget for a single Neo execution. This is
 * what actually stops a runaway investigation before the Vercel function is
 * force-killed — `maxDuration` on the route is only a last-resort safety net,
 * never the mechanism that produces a graceful, terminal result.
 *
 * `totalBudgetMs` covers planning + the tool-calling loop. `synthesisReserveMs`
 * is added on top, exclusively for the final synthesis call and persistence —
 * no new tool call may start once the tool budget is exhausted, even if the
 * synthesis reserve still has time left.
 */
export const NEO_EXECUTION_BUDGET = {
  totalBudgetMs: 240_000,
  synthesisReserveMs: 45_000,
  /**
   * A new round (or tool call) never starts with less than this much of the
   * tool budget left — starting work we already know can't finish before the
   * reserve kicks in just wastes the little time we have left.
   */
  minRoundBudgetMs: 15_000,
} as const;

export interface ExecutionBudget {
  readonly startedAt: number;
  readonly totalBudgetMs: number;
  readonly synthesisReserveMs: number;
  /** Milliseconds elapsed since the budget was created. */
  elapsedMs(): number;
  /** Milliseconds left before the tool-calling budget is exhausted (never negative). */
  toolsRemainingMs(): number;
  /** Milliseconds left in the synthesis reserve, accounting for any overrun of the tool budget. */
  synthesisRemainingMs(): number;
  /** Whether there is enough tool budget left to justify starting a new round/tool call. */
  hasRoundBudget(): boolean;
  /** Whether the entire budget (tools + synthesis reserve) has been used up. */
  isExhausted(): boolean;
  /** Total wall-clock deadline (tools + reserve), for wiring a hard AbortSignal timeout. */
  hardDeadlineMs(): number;
}

export interface ExecutionBudgetOverrides {
  totalBudgetMs?: number;
  synthesisReserveMs?: number;
  minRoundBudgetMs?: number;
}

export function createExecutionBudget(
  overrides: ExecutionBudgetOverrides = {},
  now: () => number = Date.now,
): ExecutionBudget {
  const config = { ...NEO_EXECUTION_BUDGET, ...overrides };
  const startedAt = now();

  const elapsedMs = () => now() - startedAt;
  const toolsRemainingMs = () => Math.max(0, config.totalBudgetMs - elapsedMs());
  const synthesisRemainingMs = () => {
    const overrun = Math.max(0, elapsedMs() - config.totalBudgetMs);
    return Math.max(0, config.synthesisReserveMs - overrun);
  };
  const hasRoundBudget = () => toolsRemainingMs() >= config.minRoundBudgetMs;
  const isExhausted = () => elapsedMs() >= config.totalBudgetMs + config.synthesisReserveMs;
  const hardDeadlineMs = () => config.totalBudgetMs + config.synthesisReserveMs;

  return {
    startedAt,
    totalBudgetMs: config.totalBudgetMs,
    synthesisReserveMs: config.synthesisReserveMs,
    elapsedMs,
    toolsRemainingMs,
    synthesisRemainingMs,
    hasRoundBudget,
    isExhausted,
    hardDeadlineMs,
  };
}
