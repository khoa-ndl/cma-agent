import { describe, expect, it } from "vitest";
import { searchCandidates } from "@/lib/engine/search";
import type { DataProvider, Property } from "@/lib/data/provider";
import type { Subject } from "@/lib/engine/adjustments";

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

const COMP: Property = {
  listingKey: "SCORE-1",
  listingId: "SCORE-1",
  standardStatus: "Closed",
  propertyType: "Residential",
  propertySubType: "SingleFamilyResidence",
  unparsedAddress: "1 Score St",
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
  yearBuilt: 2000,
  garageSpaces: 1,
  propertyCondition: "Good",
  listPrice: 900000,
  originalListPrice: 900000,
  closePrice: 900000,
  listingContractDate: "2026-06-01",
  closeDate: "2026-07-12",
  daysOnMarket: 41,
};

function stubProvider(rows: Property[]): DataProvider {
  return {
    searchAddresses: async () => [],
    getProperty: async () => null,
    searchListings: async () => rows,
    getAsOfDate: () => new Date("2026-10-10T00:00:00Z"),
  };
}

describe("searchCandidates scoring", () => {
  it("matches a hand-calculated similarity score", async () => {
    // Same point as the subject, so distanceScore = 1 - 0/radius = 1.
    // Size: |2000-1800|/2000 = 0.1, so sizeScore = 0.9.
    // Sub-type matches, so subTypeScore = 1.
    // Closed exactly 3 months before "as of", monthsBack 12, so
    // recencyScore = 1 - 3/12 = 0.75.
    // score = 0.35*1 + 0.30*0.9 + 0.15*1 + 0.20*0.75 = 0.92
    const candidates = await searchCandidates(stubProvider([COMP]), SUBJECT, {
      radiusMiles: 10,
      monthsBack: 12,
      sizeBandPercent: 50,
      statuses: ["Closed"],
      asOf: new Date("2026-10-10T00:00:00Z"),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].distanceMiles).toBe(0);
    expect(candidates[0].similarityScore).toBe(0.92);
  });
});
