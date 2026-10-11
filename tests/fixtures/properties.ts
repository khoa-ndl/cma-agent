import type { Property } from "@/lib/data/provider";

type FixtureInput = Partial<Property> & { listingKey: string; unparsedAddress: string };

/** Fills in every required RESO field with a sensible default, so each
 * fixture record only states the fields a test actually varies. */
function makeProperty(overrides: FixtureInput): Property {
  return {
    listingId: overrides.listingKey,
    standardStatus: "Closed",
    propertyType: "Residential",
    propertySubType: "SingleFamilyResidence",
    city: "Seattle",
    stateOrProvince: "WA",
    postalCode: "98107",
    mlsAreaMajor: "Ballard",
    latitude: 47.67,
    longitude: -122.38,
    bedroomsTotal: 3,
    bathroomsTotalInteger: 2,
    livingArea: 2000,
    lotSizeSquareFeet: 5000,
    yearBuilt: 1990,
    garageSpaces: 1,
    propertyCondition: "Good",
    listPrice: 1000000,
    originalListPrice: 1000000,
    closePrice: 980000,
    listingContractDate: "2026-07-01",
    closeDate: "2026-08-01",
    daysOnMarket: 31,
    ...overrides,
  };
}

// Deliberately varied for the provider tests: area, status, sub-type,
// living area band, close date and address prefix each differ.
export const FIXTURE_PROPERTIES: Property[] = [
  makeProperty({
    listingKey: "FX-001",
    unparsedAddress: "4200 Ballard Ave NW",
    livingArea: 2000,
    closeDate: "2026-09-15",
  }),
  makeProperty({
    listingKey: "FX-002",
    unparsedAddress: "1500 NW 65th St",
    livingArea: 1800,
    closeDate: "2026-01-10",
  }),
  makeProperty({
    listingKey: "FX-003",
    unparsedAddress: "230 24th Ave NW",
    propertySubType: "Townhouse",
    standardStatus: "Active",
    livingArea: 1500,
    closeDate: null,
    closePrice: null,
  }),
  makeProperty({
    listingKey: "FX-004",
    unparsedAddress: "4600 Ballard Ave NW",
    propertySubType: "Condominium",
    standardStatus: "Active",
    livingArea: 900,
    lotSizeSquareFeet: null,
    closeDate: null,
    closePrice: null,
  }),
  makeProperty({
    listingKey: "FX-005",
    unparsedAddress: "1000 Main St",
    city: "Bellevue",
    mlsAreaMajor: "Bellevue",
    postalCode: "98004",
    livingArea: 3000,
    closeDate: "2026-09-20",
  }),
  makeProperty({
    listingKey: "FX-006",
    unparsedAddress: "1050 Main St",
    city: "Bellevue",
    mlsAreaMajor: "Bellevue",
    postalCode: "98004",
    standardStatus: "Pending",
    livingArea: 2800,
    closeDate: null,
    closePrice: null,
  }),
];
