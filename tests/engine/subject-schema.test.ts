import { describe, expect, it } from "vitest";
import { subjectInputSchema } from "@/lib/engine/adjustments";

const VALID = {
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

describe("subjectInputSchema", () => {
  it("accepts a valid subject", () => {
    expect(subjectInputSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts a null lot size (condominiums)", () => {
    expect(subjectInputSchema.safeParse({ ...VALID, lotSizeSquareFeet: null }).success).toBe(true);
  });

  it.each([
    ["latitude out of range", { latitude: 91 }],
    ["longitude out of range", { longitude: -181 }],
    ["empty mlsAreaMajor", { mlsAreaMajor: "" }],
    ["unknown propertySubType", { propertySubType: "Commercial" }],
    ["negative bedroomsTotal", { bedroomsTotal: -1 }],
    ["negative bathroomsTotalInteger", { bathroomsTotalInteger: -1 }],
    ["zero livingArea", { livingArea: 0 }],
    ["unreasonably large livingArea", { livingArea: 1_000_000 }],
    ["negative lotSizeSquareFeet", { lotSizeSquareFeet: -1 }],
    ["yearBuilt before 1800", { yearBuilt: 1799 }],
    ["yearBuilt too far in the future", { yearBuilt: 2101 }],
    ["negative garageSpaces", { garageSpaces: -1 }],
    ["unknown propertyCondition", { propertyCondition: "Mint" }],
  ])("rejects %s", (_name, override) => {
    expect(subjectInputSchema.safeParse({ ...VALID, ...override }).success).toBe(false);
  });
});
