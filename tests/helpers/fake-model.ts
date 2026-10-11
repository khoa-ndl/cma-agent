// Scripted fake ModelTurn implementations, shared by any test that needs
// to drive the agent loop with zero API cost (Step 7's own tests, and
// Step 8's route tests, which exercise the same loop through the API).
import type { ModelTurn, ModelTurnResult } from "@/lib/agent/model-client";

export function usage(inputTokens = 100, outputTokens = 50, cacheReadTokens = 0) {
  return { inputTokens, outputTokens, cacheReadTokens };
}

export function toolTurn(name: string, input: unknown, turnUsage = usage()): ModelTurnResult {
  return { stopReason: "tool_use", content: [{ type: "tool_use", id: `call-${name}`, name, input }], usage: turnUsage };
}

export function textTurn(text: string, turnUsage = usage()): ModelTurnResult {
  return { stopReason: "end_turn", content: [{ type: "text", text }], usage: turnUsage };
}

/** Returns the scripted turns in order, then throws if asked for more —
 * a test bug (a scenario that needed more turns than scripted), not
 * something a real run should hit. */
export function scripted(turns: ModelTurnResult[]): ModelTurn {
  let i = 0;
  return async () => {
    if (i >= turns.length) throw new Error("scripted model ran out of turns — the test scripted too few");
    return turns[i++];
  };
}

/** A model that never finishes — keeps calling search_comps forever. */
export function neverFinishes(): ModelTurn {
  return async () =>
    toolTurn("search_comps", { radiusMiles: 2, monthsBack: 12, sizeBandPercent: 20, statuses: ["Closed"] });
}
