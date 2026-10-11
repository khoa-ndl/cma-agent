// Generates the Release 1 sample dataset (spec 3.2): ~10 Greater Seattle
// areas, ~1,300 closed sales and ~200 active/pending listings, RESO-named,
// with a per-area price model. Pure and deterministic — same SEED always
// produces the same records — so this file has no file I/O; scripts/
// generate-data.ts is the thin CLI wrapper that writes the JSON.
import type { GeneratedProperty } from "./property-schema";

const SEED = 20261010;
// Generation is pinned to a fixed date, not the real clock: re-running the
// generator next month must still produce byte-identical output (A1).
const GENERATED_AS_OF = new Date("2026-10-10T00:00:00Z");
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic PRNG (mulberry32) — same seed, same sequence, forever. */
function createRng(seed: number) {
  let state = seed;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = ReturnType<typeof createRng>;
const int = (rng: Rng, min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[int(rng, 0, items.length - 1)];
const round = (n: number, step: number) => Math.round(n / step) * step;

interface AreaConfig {
  name: string;
  city: string;
  postalCodes: string[];
  streets: string[];
  // Southwest and northeast corners of a small box inside the real area.
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  basePricePerSqft: number;
  subTypeMix: { type: "SingleFamilyResidence" | "Townhouse" | "Condominium"; weight: number }[];
}

// Approximate boundaries and market character of each area. Sample data
// only — never presented as real listings (spec disclosures).
const AREAS: AreaConfig[] = [
  {
    name: "Ballard",
    city: "Seattle",
    postalCodes: ["98107"],
    streets: ["NW Market St", "24th Ave NW", "Ballard Ave NW", "NW 65th St", "8th Ave NW"],
    bounds: { minLat: 47.665, maxLat: 47.685, minLng: -122.39, maxLng: -122.365 },
    basePricePerSqft: 650,
    subTypeMix: [
      { type: "Condominium", weight: 4 },
      { type: "Townhouse", weight: 3 },
      { type: "SingleFamilyResidence", weight: 3 },
    ],
  },
  {
    name: "Capitol Hill",
    city: "Seattle",
    postalCodes: ["98102", "98122"],
    streets: ["E Pike St", "15th Ave E", "Broadway E", "E Denny Way", "10th Ave E"],
    bounds: { minLat: 47.61, maxLat: 47.635, minLng: -122.325, maxLng: -122.305 },
    basePricePerSqft: 700,
    subTypeMix: [
      { type: "Condominium", weight: 6 },
      { type: "Townhouse", weight: 2 },
      { type: "SingleFamilyResidence", weight: 2 },
    ],
  },
  {
    name: "Fremont",
    city: "Seattle",
    postalCodes: ["98103"],
    streets: ["Fremont Ave N", "N 36th St", "Evanston Ave N", "N 46th St", "Phinney Ave N"],
    bounds: { minLat: 47.645, maxLat: 47.665, minLng: -122.355, maxLng: -122.33 },
    basePricePerSqft: 680,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 4 },
      { type: "Townhouse", weight: 3 },
      { type: "Condominium", weight: 3 },
    ],
  },
  {
    name: "Queen Anne",
    city: "Seattle",
    postalCodes: ["98109"],
    streets: ["Queen Anne Ave N", "W McGraw St", "10th Ave W", "Bigelow Ave N", "W Dravus St"],
    bounds: { minLat: 47.625, maxLat: 47.645, minLng: -122.37, maxLng: -122.35 },
    basePricePerSqft: 760,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 6 },
      { type: "Condominium", weight: 3 },
      { type: "Townhouse", weight: 1 },
    ],
  },
  {
    name: "West Seattle",
    city: "Seattle",
    postalCodes: ["98116", "98126"],
    streets: ["California Ave SW", "Alki Ave SW", "35th Ave SW", "SW Admiral Way", "Fauntleroy Way SW"],
    bounds: { minLat: 47.555, maxLat: 47.58, minLng: -122.39, maxLng: -122.365 },
    basePricePerSqft: 560,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 6 },
      { type: "Townhouse", weight: 2 },
      { type: "Condominium", weight: 2 },
    ],
  },
  {
    name: "Bellevue",
    city: "Bellevue",
    postalCodes: ["98004", "98005"],
    streets: ["NE 8th St", "Bellevue Way NE", "116th Ave NE", "Main St", "NE 24th St"],
    bounds: { minLat: 47.605, maxLat: 47.63, minLng: -122.21, maxLng: -122.18 },
    basePricePerSqft: 610,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 6 },
      { type: "Condominium", weight: 3 },
      { type: "Townhouse", weight: 1 },
    ],
  },
  {
    name: "Kirkland",
    city: "Kirkland",
    postalCodes: ["98033"],
    streets: ["Lake St S", "Market St", "6th St S", "NE 68th St", "Central Way"],
    bounds: { minLat: 47.675, maxLat: 47.7, minLng: -122.2, maxLng: -122.175 },
    basePricePerSqft: 585,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 6 },
      { type: "Condominium", weight: 2 },
      { type: "Townhouse", weight: 2 },
    ],
  },
  {
    name: "Redmond",
    city: "Redmond",
    postalCodes: ["98052"],
    streets: ["Avondale Rd NE", "NE 51st St", "166th Ave NE", "Redmond Way", "Education Hill Dr"],
    bounds: { minLat: 47.665, maxLat: 47.695, minLng: -122.13, maxLng: -122.1 },
    basePricePerSqft: 525,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 7 },
      { type: "Townhouse", weight: 2 },
      { type: "Condominium", weight: 1 },
    ],
  },
  {
    name: "Issaquah",
    city: "Issaquah",
    postalCodes: ["98027", "98029"],
    streets: ["Front St N", "NW Gilman Blvd", "Sunset Way", "SE Newport Way", "228th Ave SE"],
    bounds: { minLat: 47.52, maxLat: 47.55, minLng: -122.05, maxLng: -122.0 },
    basePricePerSqft: 455,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 8 },
      { type: "Townhouse", weight: 2 },
    ],
  },
  {
    name: "Shoreline",
    city: "Shoreline",
    postalCodes: ["98133"],
    streets: ["N 185th St", "Aurora Ave N", "15th Ave NE", "Meridian Ave N", "N 155th St"],
    bounds: { minLat: 47.74, maxLat: 47.765, minLng: -122.35, maxLng: -122.32 },
    basePricePerSqft: 425,
    subTypeMix: [
      { type: "SingleFamilyResidence", weight: 8 },
      { type: "Townhouse", weight: 2 },
    ],
  },
];

const CONDITIONS = ["Excellent", "Good", "Good", "Fair"] as const; // weighted toward "Good"

function weightedSubType(rng: Rng, area: AreaConfig) {
  const total = area.subTypeMix.reduce((sum, m) => sum + m.weight, 0);
  let roll = int(rng, 1, total);
  for (const m of area.subTypeMix) {
    roll -= m.weight;
    if (roll <= 0) return m.type;
  }
  return area.subTypeMix[0].type;
}

function toDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** One property, with its market value already decided (before list/close
 * price noise is layered on in buildRecord). */
function buildFeatures(rng: Rng, area: AreaConfig) {
  const subType = weightedSubType(rng, area);
  const isCondo = subType === "Condominium";
  const livingArea = isCondo ? int(rng, 550, 1600) : int(rng, 1100, 3600);
  const bedroomsTotal = isCondo ? int(rng, 1, 3) : int(rng, 2, 5);
  const bathroomsTotalInteger = Math.min(bedroomsTotal + int(rng, -1, 1), isCondo ? 2 : 4) || 1;
  const yearBuilt = int(rng, 1925, 2024);
  const garageSpaces = isCondo ? int(rng, 0, 1) : int(rng, 0, 3);
  // Null for condos. Townhomes carry only their own small deeded parcel —
  // shared HOA land isn't a per-listing RESO field, same as real MLS data.
  const lotSizeSquareFeet = isCondo
    ? null
    : subType === "Townhouse"
      ? int(rng, 800, 2500)
      : int(rng, 3000, 12000);
  const condition = pick(rng, CONDITIONS);
  return { subType, livingArea, bedroomsTotal, bathroomsTotalInteger, yearBuilt, garageSpaces, lotSizeSquareFeet, condition };
}

/** Market value from the area's base rate plus feature and condition
 * effects, before the noise and list/close variation added in buildRecord. */
function estimateValue(area: AreaConfig, f: ReturnType<typeof buildFeatures>, monthsAgo: number) {
  let value = area.basePricePerSqft * f.livingArea;
  value += f.garageSpaces * 15000;
  if (f.lotSizeSquareFeet) value += (f.lotSizeSquareFeet - 5000) * 8;
  value += (f.yearBuilt - 1975) * 300;
  const conditionFactor = { Excellent: 1.05, Good: 1.0, Fair: 0.92, Poor: 0.82 }[f.condition];
  value *= conditionFactor;
  // A gentle upward market trend over the trailing year, applied as of the
  // record's own date so older closings sit a little lower than new ones.
  value *= 1 - monthsAgo * 0.003;
  return value;
}

function buildRecord(
  rng: Rng,
  area: AreaConfig,
  index: number,
  sequence: number,
  status: "Closed" | "Active" | "Pending",
): GeneratedProperty {
  const f = buildFeatures(rng, area);

  const daysOnMarket = status === "Closed" ? int(rng, 4, 120) : int(rng, 1, 55);
  const closeOffsetDays = status === "Closed" ? int(rng, daysOnMarket, 365) : 0;
  const closeMs = GENERATED_AS_OF.getTime() - closeOffsetDays * ONE_DAY_MS;
  const listMs = status === "Closed"
    ? closeMs - daysOnMarket * ONE_DAY_MS
    : GENERATED_AS_OF.getTime() - daysOnMarket * ONE_DAY_MS;
  const monthsAgo = (GENERATED_AS_OF.getTime() - (status === "Closed" ? closeMs : listMs)) / (ONE_DAY_MS * 30);

  const marketValue = estimateValue(area, f, monthsAgo);
  // ±8% noise keeps comps realistically scattered (spec concern C6) without
  // drowning out the signal the analysis engine needs to find in Step 5.
  const noise = 1 + (rng() * 2 - 1) * 0.08;
  const originalListPrice = round(marketValue * noise, 1000);
  const hadReduction = rng() < 0.2;
  const listPrice = hadReduction ? round(originalListPrice * (1 - rng() * 0.04), 1000) : originalListPrice;
  const closePrice = status === "Closed" ? round(listPrice * (0.96 + rng() * 0.07), 500) : null;

  const listingKey = `WA-${sequence.toString().padStart(6, "0")}`;
  const houseNumber = int(rng, 100, 9999);
  const street = pick(rng, area.streets);

  return {
    listingKey,
    listingId: (30000000 + sequence).toString(),
    standardStatus: status,
    propertyType: "Residential",
    propertySubType: f.subType,
    unparsedAddress: `${houseNumber} ${street}`,
    city: area.city,
    stateOrProvince: "WA",
    postalCode: pick(rng, area.postalCodes),
    mlsAreaMajor: area.name,
    latitude: Number((area.bounds.minLat + rng() * (area.bounds.maxLat - area.bounds.minLat)).toFixed(6)),
    longitude: Number((area.bounds.minLng + rng() * (area.bounds.maxLng - area.bounds.minLng)).toFixed(6)),
    bedroomsTotal: f.bedroomsTotal,
    bathroomsTotalInteger: f.bathroomsTotalInteger,
    livingArea: f.livingArea,
    lotSizeSquareFeet: f.lotSizeSquareFeet,
    yearBuilt: f.yearBuilt,
    garageSpaces: f.garageSpaces,
    propertyCondition: f.condition,
    listPrice,
    originalListPrice,
    closePrice,
    listingContractDate: toDateString(listMs),
    closeDate: status === "Closed" ? toDateString(closeMs) : null,
    daysOnMarket,
  };
}

export const CLOSED_PER_AREA = 130;
export const ACTIVE_PER_AREA = 15;
export const PENDING_PER_AREA = 5;

/** The full sample dataset: deterministic given SEED, so this function
 * returns byte-identical output on every run (A1). */
export function generateSampleProperties(): GeneratedProperty[] {
  const rng = createRng(SEED);
  const records: GeneratedProperty[] = [];
  let sequence = 1;

  for (const area of AREAS) {
    for (let i = 0; i < CLOSED_PER_AREA; i++) {
      records.push(buildRecord(rng, area, i, sequence++, "Closed"));
    }
    for (let i = 0; i < ACTIVE_PER_AREA; i++) {
      records.push(buildRecord(rng, area, i, sequence++, "Active"));
    }
    for (let i = 0; i < PENDING_PER_AREA; i++) {
      records.push(buildRecord(rng, area, i, sequence++, "Pending"));
    }
  }

  return records;
}

export { AREAS };
