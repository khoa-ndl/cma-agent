import { describe, expect, it } from "vitest";
import { humanizeEnum, layoutCompMap, photoForListing } from "@/lib/report-formatting";

const SUBJECT = { latitude: 47.67, longitude: -122.38 };

describe("layoutCompMap", () => {
  it("places the subject at the exact center of the viewBox", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "A", latitude: 47.68, longitude: -122.37 }]);
    expect(layout.subject).toEqual({ x: 100, y: 100 });
    expect(layout.viewBoxSize).toBe(200);
  });

  it("places a comp due north closer to the top (smaller y) than the subject", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "N", latitude: SUBJECT.latitude + 0.01, longitude: SUBJECT.longitude }]);
    expect(layout.pins[0].y).toBeLessThan(100);
    expect(layout.pins[0].x).toBeCloseTo(100, 0);
  });

  it("scales the farthest comp near the edge, not past it", () => {
    const layout = layoutCompMap(SUBJECT, [
      { listingKey: "Near", latitude: SUBJECT.latitude + 0.001, longitude: SUBJECT.longitude },
      { listingKey: "Far", latitude: SUBJECT.latitude + 0.02, longitude: SUBJECT.longitude },
    ]);
    const far = layout.pins.find((p) => p.listingKey === "Far")!;
    expect(far.y).toBeGreaterThan(10); // inside the 200-unit canvas with padding, not clipped at 0
    expect(far.y).toBeLessThan(100);
  });

  it("never divides by zero with a single comp at the same coordinates as the subject (Review Focus #1/#2)", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "Same", latitude: SUBJECT.latitude, longitude: SUBJECT.longitude }]);
    expect(Number.isFinite(layout.pins[0].x)).toBe(true);
    expect(Number.isFinite(layout.pins[0].y)).toBe(true);
    expect(Number.isFinite(layout.radiusMiles)).toBe(true);
  });

  it("handles zero comps without throwing (Review Focus #2)", () => {
    const layout = layoutCompMap(SUBJECT, []);
    expect(layout.pins).toEqual([]);
    expect(Number.isFinite(layout.radiusMiles)).toBe(true);
  });

  it("fits a comp far outside a typical search radius on-canvas (Review Focus #3)", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "Far", latitude: SUBJECT.latitude + 5, longitude: SUBJECT.longitude }]);
    expect(layout.pins[0].y).toBeGreaterThanOrEqual(0);
    expect(layout.pins[0].y).toBeLessThanOrEqual(200);
  });
});

describe("photoForListing", () => {
  it("is deterministic -- the same listing key always returns the same photo", () => {
    const first = photoForListing("WA-000123", "SingleFamilyResidence");
    const second = photoForListing("WA-000123", "SingleFamilyResidence");
    expect(first).toBe(second);
  });

  it("returns a photo from the matching sub-type bucket", () => {
    expect(photoForListing("WA-000001", "Townhouse")).toContain("townhouse");
    expect(photoForListing("WA-000001", "Condominium")).toContain("condo");
  });

  it("spreads across the bucket rather than always returning the first photo", () => {
    const photos = new Set(
      Array.from({ length: 20 }, (_, i) => photoForListing(`WA-${i.toString().padStart(6, "0")}`, "SingleFamilyResidence")),
    );
    expect(photos.size).toBeGreaterThan(1);
  });
});

describe("humanizeEnum", () => {
  it("breaks a PascalCase enum value into separate words", () => {
    expect(humanizeEnum("SingleFamilyResidence")).toBe("Single Family Residence");
    expect(humanizeEnum("Condominium")).toBe("Condominium");
  });
});
