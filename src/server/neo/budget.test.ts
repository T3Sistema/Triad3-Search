import { describe, expect, it } from "vitest";
import { createExecutionBudget, NEO_EXECUTION_BUDGET } from "@/server/neo/budget";

function fakeClock(startAt = 0) {
  let now = startAt;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe("createExecutionBudget", () => {
  it("starts with the full tool budget and no synthesis reserve consumed", () => {
    const clock = fakeClock();
    const budget = createExecutionBudget({}, clock.now);
    expect(budget.toolsRemainingMs()).toBe(NEO_EXECUTION_BUDGET.totalBudgetMs);
    expect(budget.synthesisRemainingMs()).toBe(NEO_EXECUTION_BUDGET.synthesisReserveMs);
    expect(budget.hasRoundBudget()).toBe(true);
    expect(budget.isExhausted()).toBe(false);
  });

  it("depletes the tool budget as time elapses, never going negative", () => {
    const clock = fakeClock();
    const budget = createExecutionBudget({ totalBudgetMs: 100_000, synthesisReserveMs: 20_000 }, clock.now);
    clock.advance(60_000);
    expect(budget.toolsRemainingMs()).toBe(40_000);
    clock.advance(60_000);
    expect(budget.toolsRemainingMs()).toBe(0);
  });

  it("stops allowing new rounds once the remaining tool budget drops below minRoundBudgetMs", () => {
    const clock = fakeClock();
    const budget = createExecutionBudget({ totalBudgetMs: 100_000, synthesisReserveMs: 20_000, minRoundBudgetMs: 15_000 }, clock.now);
    clock.advance(90_000); // 10_000ms left — below the 15_000ms minimum
    expect(budget.hasRoundBudget()).toBe(false);
    expect(budget.isExhausted()).toBe(false); // still has synthesis reserve left
  });

  it("only starts consuming the synthesis reserve after the tool budget is fully spent", () => {
    const clock = fakeClock();
    const budget = createExecutionBudget({ totalBudgetMs: 100_000, synthesisReserveMs: 20_000 }, clock.now);
    clock.advance(80_000); // still inside the tool budget
    expect(budget.synthesisRemainingMs()).toBe(20_000);
    clock.advance(30_000); // 10_000ms into the reserve now (110_000 elapsed)
    expect(budget.synthesisRemainingMs()).toBe(10_000);
  });

  it("reports exhausted only once both the tool budget and the synthesis reserve are spent", () => {
    const clock = fakeClock();
    const budget = createExecutionBudget({ totalBudgetMs: 100_000, synthesisReserveMs: 20_000 }, clock.now);
    clock.advance(119_000);
    expect(budget.isExhausted()).toBe(false);
    clock.advance(2_000);
    expect(budget.isExhausted()).toBe(true);
    expect(budget.synthesisRemainingMs()).toBe(0);
  });

  it("exposes a hard deadline equal to totalBudgetMs + synthesisReserveMs, for wiring a real AbortSignal timeout", () => {
    const budget = createExecutionBudget({ totalBudgetMs: 240_000, synthesisReserveMs: 45_000 });
    expect(budget.hardDeadlineMs()).toBe(285_000);
  });
});
