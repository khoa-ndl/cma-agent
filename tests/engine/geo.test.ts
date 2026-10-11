import { describe, expect, it } from "vitest";
import { distanceMiles } from "@/lib/engine/geo";

describe("distanceMiles", () => {
  it("is zero for the same point", () => {
    expect(distanceMiles({ latitude: 47.67, longitude: -122.38 }, { latitude: 47.67, longitude: -122.38 })).toBe(0);
  });

  it("matches the well-known ~69 miles per degree of latitude", () => {
    const distance = distanceMiles({ latitude: 47, longitude: -122 }, { latitude: 48, longitude: -122 });
    expect(distance).toBeCloseTo(69.09, 0);
  });
});
