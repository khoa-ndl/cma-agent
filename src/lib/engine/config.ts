// Per-area adjustment table (spec 4.2): the dollar value of each factor's
// difference between a subject and a comparable. Documented here and
// shown in the PDF's methodology appendix (spec 5) — nothing hidden in a
// model prompt. Deliberately independent of the sample-data generator's
// own pricing model (src/lib/data/generator.ts): a real analyst tunes this
// table from market knowledge, not from how demo data was manufactured.
// Values are a documented starting point, roughly half each area's
// typical $/sqft for the living-area rate, with the other factors scaled
// to match; adjust here if real comps call for different weights.
export interface AdjustmentRates {
  livingAreaPerSqft: number;
  bedroom: number;
  bathroom: number;
  garageSpace: number;
  lotSizePerSqft: number;
  agePerDecade: number;
  conditionStep: number;
  /** Fraction of the comp's sale price, per month since it closed. */
  marketTimePerMonth: number;
}

export const AREA_ADJUSTMENTS: Record<string, AdjustmentRates> = {
  Ballard: {
    livingAreaPerSqft: 350,
    bedroom: 15000,
    bathroom: 12000,
    garageSpace: 10000,
    lotSizePerSqft: 8,
    agePerDecade: 3000,
    conditionStep: 25000,
    marketTimePerMonth: 0.003,
  },
  "Capitol Hill": {
    livingAreaPerSqft: 375,
    bedroom: 16000,
    bathroom: 13000,
    garageSpace: 11000,
    lotSizePerSqft: 9,
    agePerDecade: 3200,
    conditionStep: 27000,
    marketTimePerMonth: 0.003,
  },
  Fremont: {
    livingAreaPerSqft: 365,
    bedroom: 15500,
    bathroom: 12500,
    garageSpace: 10500,
    lotSizePerSqft: 8,
    agePerDecade: 3100,
    conditionStep: 26000,
    marketTimePerMonth: 0.003,
  },
  "Queen Anne": {
    livingAreaPerSqft: 405,
    bedroom: 17000,
    bathroom: 14000,
    garageSpace: 12000,
    lotSizePerSqft: 10,
    agePerDecade: 3500,
    conditionStep: 30000,
    marketTimePerMonth: 0.003,
  },
  "West Seattle": {
    livingAreaPerSqft: 300,
    bedroom: 13000,
    bathroom: 10500,
    garageSpace: 9000,
    lotSizePerSqft: 7,
    agePerDecade: 2600,
    conditionStep: 22000,
    marketTimePerMonth: 0.003,
  },
  Bellevue: {
    livingAreaPerSqft: 325,
    bedroom: 14000,
    bathroom: 11500,
    garageSpace: 10000,
    lotSizePerSqft: 9,
    agePerDecade: 2800,
    conditionStep: 24000,
    marketTimePerMonth: 0.003,
  },
  Kirkland: {
    livingAreaPerSqft: 310,
    bedroom: 13500,
    bathroom: 11000,
    garageSpace: 9500,
    lotSizePerSqft: 8,
    agePerDecade: 2700,
    conditionStep: 23000,
    marketTimePerMonth: 0.003,
  },
  Redmond: {
    livingAreaPerSqft: 280,
    bedroom: 12500,
    bathroom: 10000,
    garageSpace: 8500,
    lotSizePerSqft: 7,
    agePerDecade: 2400,
    conditionStep: 21000,
    marketTimePerMonth: 0.003,
  },
  Issaquah: {
    livingAreaPerSqft: 245,
    bedroom: 11000,
    bathroom: 9000,
    garageSpace: 7500,
    lotSizePerSqft: 6,
    agePerDecade: 2100,
    conditionStep: 18000,
    marketTimePerMonth: 0.003,
  },
  Shoreline: {
    livingAreaPerSqft: 225,
    bedroom: 10000,
    bathroom: 8500,
    garageSpace: 7000,
    lotSizePerSqft: 5,
    agePerDecade: 1900,
    conditionStep: 16000,
    marketTimePerMonth: 0.003,
  },
};

export function getAdjustmentRates(mlsAreaMajor: string): AdjustmentRates {
  const rates = AREA_ADJUSTMENTS[mlsAreaMajor];
  if (!rates) {
    throw new Error(`No adjustment rates configured for area "${mlsAreaMajor}"`);
  }
  return rates;
}
