import { describe, expect, it } from "vitest";
import { computePriceRange } from "@/lib/engine/pricing";

describe("computePriceRange (A3)", () => {
  it("matches a hand-calculated weighted average, low and high", () => {
    // weightedSum = 960,000*1 + 1,000,000*1 + 1,040,000*2 = 4,040,000
    // totalWeight = 1 + 1 + 2 = 4
    // weighted average = 1,010,000 exactly
    const result = computePriceRange([
      { listingKey: "A", adjustedValue: 960000, weight: 1 },
      { listingKey: "B", adjustedValue: 1000000, weight: 1 },
      { listingKey: "C", adjustedValue: 1040000, weight: 2 },
    ]);

    expect(result.low).toBe(960000);
    expect(result.high).toBe(1040000);
    expect(result.suggestedListPrice).toBe(1010000);
  });

  it("treats a missing weight as equal to 1", () => {
    const withDefault = computePriceRange([
      { listingKey: "A", adjustedValue: 900000 },
      { listingKey: "B", adjustedValue: 1100000 },
    ]);
    expect(withDefault.suggestedListPrice).toBe(1000000);
  });

  it("rejects an empty comparable list", () => {
    expect(() => computePriceRange([])).toThrow();
  });
});
