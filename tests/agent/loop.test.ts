import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { property } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { FIXTURE_PROPERTIES } from "../fixtures/properties";
import { runCmaAgent, type AgentProgressEvent, type AgentRunOutcome } from "@/lib/agent/loop";
import type { ModelTurn, ModelTurnResult } from "@/lib/agent/model-client";
import type { Subject } from "@/lib/engine/adjustments";
import { computePriceRange } from "@/lib/engine/pricing";

const SUBJECT: Subject = {
  latitude: 47.67,
  longitude: -122.38,
  mlsAreaMajor: "Ballard",
  propertySubType: "SingleFamilyResidence",
  bedroomsTotal: 3,
  bathroomsTotalInteger: 2,
  livingArea: 2000,
  lotSizeSquareFeet: 5000,
  yearBuilt: 2000,
  garageSpaces: 1,
  propertyCondition: "Good",
};

function usage(inputTokens = 100, outputTokens = 50, cacheReadTokens = 0) {
  return { inputTokens, outputTokens, cacheReadTokens };
}

function toolTurn(name: string, input: unknown, turnUsage = usage()): ModelTurnResult {
  return { stopReason: "tool_use", content: [{ type: "tool_use", id: `call-${name}`, name, input }], usage: turnUsage };
}
function textTurn(text: string, turnUsage = usage()): ModelTurnResult {
  return { stopReason: "end_turn", content: [{ type: "text", text }], usage: turnUsage };
}

/** Returns the scripted turns in order, then throws if asked for more —
 * a test bug (a scenario that needed more turns than scripted), not
 * something a real run should hit. */
function scripted(turns: ModelTurnResult[]): ModelTurn {
  let i = 0;
  return async () => {
    if (i >= turns.length) throw new Error("scripted model ran out of turns — the test scripted too few");
    return turns[i++];
  };
}

/** A model that never finishes — keeps calling search_comps forever. */
function neverFinishes(): ModelTurn {
  return async () =>
    toolTurn("search_comps", { radiusMiles: 2, monthsBack: 12, sizeBandPercent: 20, statuses: ["Closed"] });
}

async function drain(
  gen: AsyncGenerator<AgentProgressEvent, AgentRunOutcome>,
): Promise<{ events: AgentProgressEvent[]; outcome: AgentRunOutcome }> {
  const events: AgentProgressEvent[] = [];
  let result = await gen.next();
  while (!result.done) {
    events.push(result.value);
    result = await gen.next();
  }
  return { events, outcome: result.value };
}

describe("runCmaAgent", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(property).values(FIXTURE_PROPERTIES);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("succeeds end to end, with figures equal to the engine's own output (A5)", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const model = scripted([
      toolTurn("search_comps", { radiusMiles: 10, monthsBack: 12, sizeBandPercent: 50, statuses: ["Closed"] }),
      toolTurn("compute_adjustments", { listingKeys: ["FX-001", "FX-002"] }),
      toolTurn("submit_cma", {
        selectedComps: [
          { listingKey: "FX-001", weight: 1 },
          { listingKey: "FX-002", weight: 2 },
        ],
        excludedComps: [],
        rationale: "test",
      }),
    ]);

    const { events, outcome } = await drain(runCmaAgent(SUBJECT, provider, model));

    expect(outcome.status).toBe("succeeded");
    if (outcome.status !== "succeeded") throw new Error("expected success");

    // The loop picks its own "as of" timestamp internally, which this
    // test can't predict exactly — so rather than re-deriving the dollar
    // amount a second time (tools.test.ts already does that precisely,
    // with a fixed asOf it controls), this checks the invariant A5 is
    // really about: the figures are never something the model stated,
    // only ever something engine code computed. basePrice is the
    // fixture's own closePrice, independent of asOf, and the total
    // adjustment must arithmetically match the adjusted value.
    const fx1 = FIXTURE_PROPERTIES.find((p) => p.listingKey === "FX-001")!;
    const comp1 = outcome.result.selectedComps.find((c) => c.listingKey === "FX-001")!;
    expect(comp1.basePrice).toBe(fx1.closePrice);
    expect(comp1.adjustedValue).toBe(comp1.basePrice + comp1.totalAdjustment);

    // The range is exactly what computePriceRange produces from the
    // result's own comps — never a number asserted separately from them.
    const expectedRange = computePriceRange(
      outcome.result.selectedComps.map((c) => ({ listingKey: c.listingKey, adjustedValue: c.adjustedValue, weight: c.weight })),
    );
    expect(outcome.result.valueRange).toEqual(expectedRange);

    // A14: usage is the sum of every scripted turn's usage, and cost is
    // computed from Sonnet 5.5's published per-token rates.
    expect(outcome.usage).toEqual({ inputTokens: 300, outputTokens: 150, cacheReadTokens: 0 });
    expect(outcome.costUsd).toBeCloseTo((300 / 1e6) * 2 + (150 / 1e6) * 10, 10);

    expect(events.filter((e) => e.type === "tool_call").map((e) => (e as { tool: string }).tool)).toEqual([
      "search_comps",
      "compute_adjustments",
      "submit_cma",
    ]);
  });

  it("stops at the turn limit if the model never calls submit_cma (A11)", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const { outcome } = await drain(runCmaAgent(SUBJECT, provider, neverFinishes()));

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") throw new Error("expected failure");
    expect(outcome.failureReason).toBe("turn_limit_exceeded");
  });

  it("stops immediately on a refusal, without spending further turns", async () => {
    let calls = 0;
    const provider = createSampleDataProvider(testDb.db);
    const model: ModelTurn = async () => {
      calls++;
      return { stopReason: "refusal", content: [], usage: usage() };
    };

    const { outcome } = await drain(runCmaAgent(SUBJECT, provider, model));

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") throw new Error("expected failure");
    expect(outcome.failureReason).toBe("refusal");
    expect(calls).toBe(1);
  });

  it("stops on a truncated (max_tokens) response", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const model: ModelTurn = async () => ({ stopReason: "max_tokens", content: [], usage: usage() });

    const { outcome } = await drain(runCmaAgent(SUBJECT, provider, model));

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") throw new Error("expected failure");
    expect(outcome.failureReason).toBe("truncated");
  });

  it("stops once cumulative output tokens cross the ceiling, before the turn limit", async () => {
    const provider = createSampleDataProvider(testDb.db);
    // 20,000 output tokens per turn; the ceiling (50,000) is crossed on
    // the 3rd turn, well before the 10-turn limit.
    const model: ModelTurn = async () =>
      toolTurn(
        "search_comps",
        { radiusMiles: 2, monthsBack: 12, sizeBandPercent: 20, statuses: ["Closed"] },
        usage(100, 20000, 0),
      );

    const { outcome } = await drain(runCmaAgent(SUBJECT, provider, model));

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") throw new Error("expected failure");
    expect(outcome.failureReason).toBe("token_limit_exceeded");
    expect(outcome.usage.outputTokens).toBe(60000);
  });

  it("nudges a plain-text turn instead of failing, and still succeeds afterward", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const model = scripted([
      textTurn("Let me think about this out loud first."),
      toolTurn("compute_adjustments", { listingKeys: ["FX-001"] }),
      toolTurn("submit_cma", {
        selectedComps: [{ listingKey: "FX-001", weight: 1 }],
        excludedComps: [],
        rationale: "test",
      }),
    ]);

    const { outcome } = await drain(runCmaAgent(SUBJECT, provider, model));
    expect(outcome.status).toBe("succeeded");
  });

  it("recovers from submit_cma's own validation error instead of ending the run", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const model = scripted([
      // References a comp never adjusted — submit_cma rejects this, but
      // the run must continue, not fail outright.
      toolTurn("submit_cma", {
        selectedComps: [{ listingKey: "FX-001", weight: 1 }],
        excludedComps: [],
        rationale: "premature",
      }),
      toolTurn("compute_adjustments", { listingKeys: ["FX-001"] }),
      toolTurn("submit_cma", {
        selectedComps: [{ listingKey: "FX-001", weight: 1 }],
        excludedComps: [],
        rationale: "test",
      }),
    ]);

    const { events, outcome } = await drain(runCmaAgent(SUBJECT, provider, model));
    expect(outcome.status).toBe("succeeded");
    expect(events.some((e) => e.type === "tool_result" && !e.ok)).toBe(true);
  });

  it("passes a thinking block back unmodified on the next turn, not corrupted into empty text", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const thinkingBlock = {
      type: "thinking" as const,
      thinking: "Let me consider the comps carefully.",
      signature: "sig-abc123",
    };
    let callCount = 0;
    let secondCallMessages: unknown[] = [];

    const model: ModelTurn = async (messages) => {
      callCount++;
      if (callCount === 1) {
        return {
          stopReason: "tool_use",
          content: [
            thinkingBlock,
            { type: "tool_use", id: "call-1", name: "compute_adjustments", input: { listingKeys: ["FX-001"] } },
          ],
          usage: usage(),
        };
      }
      secondCallMessages = messages;
      return toolTurn("submit_cma", {
        selectedComps: [{ listingKey: "FX-001", weight: 1 }],
        excludedComps: [],
        rationale: "test",
      });
    };

    const { outcome } = await drain(runCmaAgent(SUBJECT, provider, model));
    expect(outcome.status).toBe("succeeded");

    const assistantMessage = secondCallMessages.find(
      (m): m is { role: string; content: Array<{ type: string }> } =>
        typeof m === "object" && m !== null && "role" in m && (m as { role: string }).role === "assistant",
    );
    const thinkingInHistory = assistantMessage?.content.find((b) => b.type === "thinking");
    expect(thinkingInHistory).toEqual({
      type: "thinking",
      thinking: thinkingBlock.thinking,
      signature: thinkingBlock.signature,
    });
  });

  it("reports an unknown tool name as an error and keeps going", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const model = scripted([
      toolTurn("not_a_real_tool", {}),
      toolTurn("compute_adjustments", { listingKeys: ["FX-001"] }),
      toolTurn("submit_cma", {
        selectedComps: [{ listingKey: "FX-001", weight: 1 }],
        excludedComps: [],
        rationale: "test",
      }),
    ]);

    const { outcome } = await drain(runCmaAgent(SUBJECT, provider, model));
    expect(outcome.status).toBe("succeeded");
  });
});
