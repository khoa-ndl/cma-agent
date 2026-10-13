import { distanceMiles, type LatLng } from "@/lib/engine/geo";

// Shared between the web results page and the PDF (spec 5 screens 3–4
// and 5) so a label or the currency format can't drift between the two
// renderings of the same report.
export const ADJUSTMENT_FACTORS: Array<[string, string]> = [
  ["livingArea", "Living area"],
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "Bathrooms"],
  ["garageSpaces", "Garage"],
  ["lotSize", "Lot size"],
  ["age", "Age"],
  ["condition", "Condition"],
  ["marketTime", "Market time"],
];

export function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// Pure geometry for the subject/comp map (spec 5 screens 3 and 5): shared
// by the web results page and the PDF so the pin positions can't drift
// between the two renderings of the same report. Equirectangular
// approximation is fine at this scale -- comps are at most tens of miles
// out, never far enough for a real map projection to matter.
const MILES_PER_DEGREE_LATITUDE = 69.0;
const MILES_PER_DEGREE_LONGITUDE_AT_EQUATOR = 69.172;

export interface MapPin {
  listingKey: string;
  x: number; // SVG viewBox units, 0-200
  y: number;
  distanceMiles: number;
}

export interface CompMapLayout {
  viewBoxSize: number; // always 200
  subject: { x: number; y: number }; // always the center, { x: 100, y: 100 }
  pins: MapPin[];
  radiusMiles: number; // the farthest pin's distance -- what the boundary circle, if drawn, represents
}

export function layoutCompMap(subject: LatLng, comps: Array<LatLng & { listingKey: string }>): CompMapLayout {
  const viewBoxSize = 200;
  const center = { x: viewBoxSize / 2, y: viewBoxSize / 2 };
  const padding = 0.15;
  const maxRadiusUnits = (viewBoxSize / 2) * (1 - padding);

  // Equirectangular approximation: convert each comp's lat/long delta from
  // the subject into miles, using the subject's latitude to correct the
  // longitude degree-to-mile ratio (degrees of longitude shrink in real
  // distance as you move away from the equator).
  const milesPerDegreeLongitude = MILES_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos((subject.latitude * Math.PI) / 180);

  const offsets = comps.map((comp) => {
    const dxMiles = (comp.longitude - subject.longitude) * milesPerDegreeLongitude;
    const dyMiles = (comp.latitude - subject.latitude) * MILES_PER_DEGREE_LATITUDE;
    return { comp, dxMiles, dyMiles, distanceMiles: distanceMiles(subject, comp) };
  });

  const realMaxDistance = offsets.reduce((max, o) => Math.max(max, o.distanceMiles), 0);
  const radiusMiles = realMaxDistance;

  // Guard the scale divisor against zero: empty comps, or every comp at
  // the subject's exact coordinates, would otherwise divide by zero.
  const EPSILON_MILES = 1e-6;
  const scaleDivisor = Math.max(realMaxDistance, EPSILON_MILES);
  const unitsPerMile = maxRadiusUnits / scaleDivisor;

  const pins: MapPin[] = offsets.map(({ comp, dxMiles, dyMiles, distanceMiles: d }) => ({
    listingKey: comp.listingKey,
    x: center.x + dxMiles * unitsPerMile,
    // North is up; SVG y grows downward, so increasing latitude (north)
    // must decrease y.
    y: center.y - dyMiles * unitsPerMile,
    distanceMiles: d,
  }));

  return {
    viewBoxSize,
    subject: center,
    pins,
    radiusMiles,
  };
}

// Assigns each comp/subject listing a bundled stock photo (spec screens 3-5
// comp cards and PDF): the comp-sale dataset is entirely synthetic, so these
// are generic, properly-licensed exterior photos -- not real photos of real
// addresses -- bucketed by property sub-type. See
// public/images/properties/SOURCES.md for licensing. Shared between the web
// results page and the PDF so the same listing always gets the same photo in
// both renderings.
const PHOTO_BUCKETS: Record<string, { name: string; count: number }> = {
  SingleFamilyResidence: { name: "single-family", count: 6 },
  Condominium: { name: "condo", count: 6 },
  Townhouse: { name: "townhouse", count: 6 },
};

export function photoForListing(listingKey: string, propertySubType: string): string {
  const bucket = PHOTO_BUCKETS[propertySubType] ?? PHOTO_BUCKETS.SingleFamilyResidence;

  // Simple deterministic string hash (djb2) -- no security property needed,
  // only a stable, well-spread distribution across each bucket's photos.
  let hash = 5381;
  for (let i = 0; i < listingKey.length; i++) {
    hash = (hash * 33) ^ listingKey.charCodeAt(i);
  }
  const index = Math.abs(hash) % bucket.count;

  return `/images/properties/${bucket.name}-${index + 1}.jpg`;
}
