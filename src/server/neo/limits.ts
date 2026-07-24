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
  maxRounds: 10,
  /** Max total tool calls (across all rounds) within a single execution. */
  maxToolCalls: 20,
  /** Max independent tool calls executed concurrently within one round. */
  maxParallelTools: 3,
  /** Per-tool-call timeout. */
  toolTimeoutMs: 45_000,
  /** Wall-clock budget for the whole execution before forcing a partial report. */
  totalTimeoutMs: 280_000,
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
} as const;

export type NeoLimits = typeof NEO_LIMITS;
