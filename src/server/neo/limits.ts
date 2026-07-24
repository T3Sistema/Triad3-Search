import "server-only";
import { NEO_MESSAGE_MAX_LENGTH } from "@/lib/neo/limits";

/**
 * Central, server-only limits for every Neo execution. Adjust these after
 * real-world testing — but they must always exist and always be enforced by
 * the orchestrator (src/server/neo/orchestrator.ts, executor.ts), never left
 * to the model's own judgement.
 */
export const NEO_LIMITS = {
  /** Max planner/tool-decision rounds within a single execution. */
  maxRounds: 4,
  /** Max total tool calls (across all rounds) within a single execution. */
  maxToolCalls: 12,
  /** Max `pesquisar_web` calls within a single execution — the tool most prone to unbounded repetition. */
  maxSearchCalls: 6,
  /** Max independent tool calls executed concurrently within one round. */
  maxParallelTools: 3,
  /**
   * Wall-clock budget for the whole execution: see src/server/neo/budget.ts
   * (NEO_EXECUTION_BUDGET) for the actual enforced totals — kept in its own
   * module because it needs its own testable clock, not just static numbers.
   */
  /** Max concurrent active executions per user, across all conversations. */
  maxConcurrentExecutionsPerUser: 2,
  /** Only one active execution per conversation at a time. */
  maxActiveExecutionsPerConversation: 1,
  /** Max characters accepted for an incoming user message. */
  maxMessageLength: NEO_MESSAGE_MAX_LENGTH,
  /** Max characters of normalized tool-result content handed back to the model per call. */
  maxNormalizedContentChars: 6_000,
  /** Max retries for transient tool failures (network/timeout/5xx). Never retries validation/authorization errors. */
  maxToolRetries: 2,
  /** How many recent messages are sent verbatim before relying on the rolling summary. */
  recentMessagesWindow: 12,
  /** Conversation length (message count) that triggers a summary refresh. */
  summaryRefreshThreshold: 20,
  /** How often the orchestrator writes a heartbeat (DB + SSE event) while an execution is running. */
  heartbeatIntervalMs: 12_000,
  /**
   * Extra grace period added on top of the execution budget's hard deadline
   * before server-side reconciliation treats a non-terminal execution as
   * orphaned. Must stay comfortably larger than the gap between the budget's
   * hard deadline and the route's `maxDuration`, so reconciliation never
   * races a legitimately still-running instance.
   */
  orphanGraceMs: 30_000,
} as const;

export type NeoLimits = typeof NEO_LIMITS;
