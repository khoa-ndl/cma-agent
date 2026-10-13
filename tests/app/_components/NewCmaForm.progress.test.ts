import { describe, expect, it } from "vitest";
import { computeProgress } from "@/app/_components/NewCmaForm";
import type { ReportStreamEvent } from "@/app/api/reports/logic";

function toolResult(tool: string, ok = true): ReportStreamEvent {
  return { type: "tool_result", turn: 1, tool, ok };
}

function toolCall(tool: string): ReportStreamEvent {
  return { type: "tool_call", turn: 1, tool, input: {} };
}

describe("computeProgress", () => {
  it("is 0 with no events yet", () => {
    expect(computeProgress([])).toBe(0);
  });

  it("gives partial credit for an in-flight call before its result", () => {
    expect(computeProgress([toolCall("search_comps")])).toBeGreaterThan(0);
    expect(computeProgress([toolCall("search_comps")])).toBeLessThan(computeProgress([toolResult("search_comps")]));
  });

  it("advances as each of the 4 known steps completes", () => {
    const afterOne = computeProgress([toolResult("search_comps")]);
    const afterTwo = computeProgress([toolResult("search_comps"), toolResult("compute_adjustments")]);
    expect(afterTwo).toBeGreaterThan(afterOne);
  });

  it("never reaches 100 -- only the caller's own done-event check does that", () => {
    const allFour = computeProgress([
      toolResult("search_comps"),
      toolResult("compute_adjustments"),
      toolResult("compute_price_range"),
      toolResult("submit_cma"),
    ]);
    expect(allFour).toBeLessThan(100);
  });

  it("doesn't go backwards when a step is retried after a failure", () => {
    const beforeRetry = computeProgress([toolResult("compute_adjustments")]);
    const duringRetry = computeProgress([
      toolResult("compute_adjustments"),
      toolCall("compute_adjustments"),
      toolResult("compute_adjustments", false),
    ]);
    expect(duringRetry).toBeGreaterThanOrEqual(beforeRetry);
  });

  it("ignores a failed tool_result as if that step never completed", () => {
    expect(computeProgress([toolResult("search_comps", false)])).toBe(0);
  });
});
