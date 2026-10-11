import { describe, expect, it } from "vitest";
import { computeAdjustments, type Subject } from "@/lib/engine/adjustments";
import { AREA_ADJUSTMENTS } from "@/lib/engine/config";
import type { Property } from "@/lib/data/provider";

const BALLARD_RATES = AREA_ADJUSTMENTS.Ballard;

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

function makeComp(overrides: Partial<Property>): Property {
  return {
    listingKey: "COMP-1",
    listingId: "COMP-1",
    standardStatus: "Closed",
    propertyType: "Residential",
    propertySubType: "SingleFamilyResidence",
    unparsedAddress: "1 Test St",
    city: "Seattle",
    stateOrProvince: "WA",
    postalCode: "98107",
    mlsAreaMajor: "Ballard",
    latitude: 47.67,
    longitude: -122.38,
    bedroomsTotal: 3,
    bathroomsTotalInteger: 2,
    livingArea: 1800,
    lotSizeSquareFeet: 5000,
    yearBuilt: 1990,
    garageSpaces: 1,
    propertyCondition: "Good",
    listPrice: 900000,
    originalListPrice: 900000,
    closePrice: 900000,
    listingContractDate: "2026-07-01",
    closeDate: "2026-08-11",
    daysOnMarket: 41,
    ...overrides,
  };
}

describe("computeAdjustments (A3)", () => {
  it("matches a hand-calculated total", () => {
    // livingArea: (2000-1800)*350 = 70,000
    // age: ((2000-1990)/10)*3000 = 3,000
    // marketTime: 60 days (2026-08-11 to 2026-10-10) = 2 months exactly;
    //   900,000 * 0.003 * 2 = 5,400
    // every other factor is identical between subject and comp = 0
    // total = 70,000 + 3,000 + 5,400 = 78,400
    const result = computeAdjustments(SUBJECT, makeComp({}), BALLARD_RATES, new Date("2026-10-10T00:00:00Z"));

    expect(result.basePrice).toBe(900000);
    expect(result.totalAdjustment).toBe(78400);
    expect(result.adjustedValue).toBe(978400);
  });

  it("does not treat a condo's null lot as a zero-size lot", () => {
    const condoComp = makeComp({ propertySubType: "Condominium", lotSizeSquareFeet: null });
    const result = computeAdjustments(SUBJECT, condoComp, BALLARD_RATES, new Date("2026-10-10T00:00:00Z"));
    const lotLineItem = result.lineItems.find((item) => item.factor === "lotSize");
    expect(lotLineItem?.amount).toBe(0);
  });

  it("uses list price when there is no close price (an active listing)", () => {
    const activeComp = makeComp({
      standardStatus: "Active",
      closePrice: null,
      closeDate: null,
      listPrice: 950000,
    });
    const result = computeAdjustments(SUBJECT, activeComp, BALLARD_RATES, new Date("2026-10-10T00:00:00Z"));
    expect(result.basePrice).toBe(950000);
    // No close date, so no market-time adjustment.
    expect(result.lineItems.find((item) => item.factor === "marketTime")?.amount).toBe(0);
  });
});
