import { describe, expect, it } from "vitest";
import {
  AREAS,
  ACTIVE_PER_AREA,
  CLOSED_PER_AREA,
  PENDING_PER_AREA,
  generateSampleProperties,
} from "@/lib/data/generator";
import { propertySchema } from "@/lib/data/property-schema";

describe("generateSampleProperties (A1)", () => {
  it("is deterministic: the same seed produces byte-identical output", () => {
    const first = generateSampleProperties();
    const second = generateSampleProperties();
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("produces every record in RESO shape", () => {
    const records = generateSampleProperties();
    for (const record of records) {
      expect(() => propertySchema.parse(record)).not.toThrow();
    }
  });

  it("covers all 10 areas with the target counts per status", () => {
    const records = generateSampleProperties();
    const perArea = CLOSED_PER_AREA + ACTIVE_PER_AREA + PENDING_PER_AREA;
    expect(records).toHaveLength(AREAS.length * perArea);

    for (const area of AREAS) {
      const inArea = records.filter((r) => r.mlsAreaMajor === area.name);
      expect(inArea.filter((r) => r.standardStatus === "Closed")).toHaveLength(CLOSED_PER_AREA);
      expect(inArea.filter((r) => r.standardStatus === "Active")).toHaveLength(ACTIVE_PER_AREA);
      expect(inArea.filter((r) => r.standardStatus === "Pending")).toHaveLength(PENDING_PER_AREA);
    }

    const total = records.length;
    expect(total).toBeGreaterThanOrEqual(1300);
    const closed = records.filter((r) => r.standardStatus === "Closed").length;
    expect(closed).toBeGreaterThanOrEqual(1200);
  });

  it("has unique listing keys and condos with no lot size", () => {
    const records = generateSampleProperties();
    const keys = new Set(records.map((r) => r.listingKey));
    expect(keys.size).toBe(records.length);

    for (const r of records.filter((r) => r.propertySubType === "Condominium")) {
      expect(r.lotSizeSquareFeet).toBeNull();
    }
  });

  it("closes only in the trailing 12 months before the fixed generation date", () => {
    const records = generateSampleProperties();
    const asOf = new Date("2026-10-10T00:00:00Z").getTime();
    const yearBefore = asOf - 366 * 24 * 60 * 60 * 1000;
    for (const r of records.filter((r) => r.closeDate)) {
      const closeMs = new Date(r.closeDate as string).getTime();
      expect(closeMs).toBeLessThanOrEqual(asOf);
      expect(closeMs).toBeGreaterThanOrEqual(yearBefore);
    }
  });
});
