import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { property } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { FIXTURE_PROPERTIES } from "../fixtures/properties";
import { createRunState, createTools } from "@/lib/agent/tools";
import type { Subject } from "@/lib/engine/adjustments";
import { computeAdjustments } from "@/lib/engine/adjustments";
import { computePriceRange } from "@/lib/engine/pricing";
import { getAdjustmentRates } from "@/lib/engine/config";

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
const AS_OF = new Date("2026-10-10T00:00:00Z");
const RATES = getAdjustmentRates("Ballard");
const FX_001 = FIXTURE_PROPERTIES.find((p) => p.listingKey === "FX-001")!;
const FX_002 = FIXTURE_PROPERTIES.find((p) => p.listingKey === "FX-002")!;

describe("agent tools", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(property).values(FIXTURE_PROPERTIES);
  });

  afterEach(async () => {
    await testDb.close();
  });

  function setup() {
    const provider = createSampleDataProvider(testDb.db);
    const state = createRunState();
    return { ...createTools(SUBJECT, provider, AS_OF, state), state };
  }

  it("declares all 4 tools, strict, with the cache breakpoint on the last one", () => {
    const { tools } = setup();
    expect(tools.map((t) => t.name)).toEqual([
      "search_comps",
      "compute_adjustments",
      "compute_price_range",
      "submit_cma",
    ]);
    for (const tool of tools) {
      expect(tool.strict).toBe(true);
      expect(tool.input_schema.type).toBe("object");
    }
    expect(tools[0].cache_control).toBeUndefined();
    expect(tools.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("never sends numeric-range keywords Anthropic's strict tool schema rejects (A4 live failure)", () => {
    // Confirmed against the real API (2026-10-10): a strict custom tool rejects
    // numeric bounds ("For 'number' type, properties exclusiveMinimum, maximum
    // are not supported") and array-length bounds ("For 'array' type, property
    // 'maxItems' is not supported") — exactly what zod's .positive()/.max()/
    // .min() produce.
    const { tools } = setup();
    const banned = [
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "minItems",
      "maxItems",
      "minLength",
      "maxLength",
    ];

    function walk(node: unknown): void {
      if (node === null || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      for (const key of banned) {
        expect(node).not.toHaveProperty(key);
      }
      for (const value of Object.values(node)) walk(value);
    }

    for (const tool of tools) walk(tool.input_schema);
  });

  it("search_comps returns scored candidates", async () => {
    const { handlers } = setup();
    const result = await handlers.search_comps({
      radiusMiles: 10,
      monthsBack: 12,
      sizeBandPercent: 50,
      statuses: ["Closed"],
    });
    expect(result.isError).toBeUndefined();
    const candidates = JSON.parse(result.content);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]).toHaveProperty("similarityScore");
  });

  it("search_comps rejects invalid input instead of throwing", async () => {
    const { handlers } = setup();
    const result = await handlers.search_comps({ radiusMiles: -1 });
    expect(result.isError).toBe(true);
  });

  it("compute_adjustments matches the engine directly and records state for submit_cma", async () => {
    const { handlers, state } = setup();
    const result = await handlers.compute_adjustments({ listingKeys: ["FX-001"] });
    expect(result.isError).toBeUndefined();

    const expected = computeAdjustments(SUBJECT, FX_001, RATES, AS_OF);
    const parsed = JSON.parse(result.content);
    expect(parsed[0].adjustedValue).toBe(expected.adjustedValue);
    expect(state.computedAdjustments.get("FX-001")?.adjustment.adjustedValue).toBe(expected.adjustedValue);
  });

  it("compute_adjustments reports an unknown listing key without crashing", async () => {
    const { handlers } = setup();
    const result = await handlers.compute_adjustments({ listingKeys: ["does-not-exist"] });
    const parsed = JSON.parse(result.content);
    expect(parsed[0].error).toBeDefined();
  });

  it("compute_price_range matches the engine directly", async () => {
    const { handlers } = setup();
    const comps = [
      { listingKey: "A", adjustedValue: 900000, weight: 1 },
      { listingKey: "B", adjustedValue: 1100000, weight: 1 },
    ];
    const result = await handlers.compute_price_range({ comps });
    expect(JSON.parse(result.content)).toEqual(computePriceRange(comps));
  });

  describe("submit_cma", () => {
    it("rejects a comp that was never adjusted", async () => {
      const { handlers } = setup();
      const result = await handlers.submit_cma({
        selectedComps: [{ listingKey: "FX-001", weight: 1 }],
        rationale: "test",
      });
      expect(result.isError).toBe(true);
      expect(result.finalResult).toBeUndefined();
    });

    it("produces figures that equal the engine's own output, not anything echoed back (A5)", async () => {
      const { handlers } = setup();
      await handlers.compute_adjustments({ listingKeys: ["FX-001", "FX-002"] });

      const result = await handlers.submit_cma({
        selectedComps: [
          { listingKey: "FX-001", weight: 1 },
          { listingKey: "FX-002", weight: 2 },
        ],
        excludedComps: [{ listingKey: "FX-003", reason: "too small for this comparison" }],
        rationale: "test rationale",
      });

      expect(result.isError).toBeUndefined();
      const final = result.finalResult!;

      const exp1 = computeAdjustments(SUBJECT, FX_001, RATES, AS_OF);
      const exp2 = computeAdjustments(SUBJECT, FX_002, RATES, AS_OF);
      const expectedRange = computePriceRange([
        { listingKey: "FX-001", adjustedValue: exp1.adjustedValue, weight: 1 },
        { listingKey: "FX-002", adjustedValue: exp2.adjustedValue, weight: 2 },
      ]);

      expect(final.selectedComps.find((c) => c.listingKey === "FX-001")?.adjustedValue).toBe(exp1.adjustedValue);
      expect(final.selectedComps.find((c) => c.listingKey === "FX-002")?.adjustedValue).toBe(exp2.adjustedValue);
      expect(final.valueRange).toEqual(expectedRange);
      expect(final.excludedComps).toEqual([{ listingKey: "FX-003", reason: "too small for this comparison" }]);
    });
  });
});
