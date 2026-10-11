// Candidate search and similarity scoring (spec 4.1, 4.2). The agent
// (Step 7) picks the final comps from what this returns; this file only
// finds and scores candidates, deterministically.
import type { DataProvider, Property } from "@/lib/data/provider";
import { distanceMiles } from "./geo";
import type { Subject } from "./adjustments";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

export interface SearchCandidatesOptions {
  radiusMiles: number;
  monthsBack: number;
  /** e.g. 20 means ±20% of the subject's living area. */
  sizeBandPercent: number;
  statuses: Property["standardStatus"][];
  asOf: Date;
  excludeListingKey?: string;
  limit?: number;
}

export interface ScoredCandidate {
  property: Property;
  distanceMiles: number;
  /** 0–1, higher is more similar. */
  similarityScore: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreCandidate(
  subject: Subject,
  comp: Property,
  distance: number,
  options: SearchCandidatesOptions,
): number {
  const distanceScore = clamp01(1 - distance / options.radiusMiles);
  const sizeScore = clamp01(1 - Math.abs(subject.livingArea - comp.livingArea) / subject.livingArea);
  const subTypeScore = subject.propertySubType === comp.propertySubType ? 1 : 0.6;

  let recencyScore = 1;
  if (comp.closeDate) {
    const monthsSinceClose = (options.asOf.getTime() - new Date(comp.closeDate).getTime()) / MS_PER_MONTH;
    recencyScore = clamp01(1 - monthsSinceClose / options.monthsBack);
  }

  const score = 0.35 * distanceScore + 0.3 * sizeScore + 0.15 * subTypeScore + 0.2 * recencyScore;
  return Math.round(score * 100) / 100;
}

// Restricted to the subject's own mlsAreaMajor, not a true cross-area
// radius search: a comp just across a neighboring area's boundary is
// never considered, even if closer than one inside the same area. This
// matches comparing within the same named market, a standard CMA
// convention — radius then narrows further within that area.
export async function searchCandidates(
  provider: DataProvider,
  subject: Subject,
  options: SearchCandidatesOptions,
): Promise<ScoredCandidate[]> {
  // livingArea is an integer column; a fractional band bound (e.g. 536.8
  // sqft) is rejected by Postgres, including the real Neon database.
  const sizeBand = {
    minLivingArea: Math.round(subject.livingArea * (1 - options.sizeBandPercent / 100)),
    maxLivingArea: Math.round(subject.livingArea * (1 + options.sizeBandPercent / 100)),
  };

  // The provider's closedAfter filter excludes rows with no close date
  // (see provider.ts) — Active/Pending listings would be silently dropped
  // if closed and current statuses were requested in one call, so each
  // group is searched separately and the results merged.
  const closedStatuses = options.statuses.filter((s) => s === "Closed");
  const currentStatuses = options.statuses.filter((s) => s !== "Closed");
  const calls: Promise<Property[]>[] = [];

  if (closedStatuses.length) {
    const cutoff = new Date(options.asOf);
    cutoff.setMonth(cutoff.getMonth() - options.monthsBack);
    calls.push(
      provider.searchListings({
        ...sizeBand,
        statuses: closedStatuses,
        mlsAreaMajor: subject.mlsAreaMajor,
        closedAfter: cutoff.toISOString().slice(0, 10),
        excludeListingKey: options.excludeListingKey,
        limit: options.limit,
      }),
    );
  }
  if (currentStatuses.length) {
    calls.push(
      provider.searchListings({
        ...sizeBand,
        statuses: currentStatuses,
        mlsAreaMajor: subject.mlsAreaMajor,
        excludeListingKey: options.excludeListingKey,
        limit: options.limit,
      }),
    );
  }

  const rows = (await Promise.all(calls)).flat();

  return rows
    .map((candidateProperty) => {
      const distance = distanceMiles(subject, candidateProperty);
      return {
        property: candidateProperty,
        distanceMiles: Math.round(distance * 100) / 100,
        similarityScore: scoreCandidate(subject, candidateProperty, distance, options),
      };
    })
    .filter((c) => c.distanceMiles <= options.radiusMiles)
    .sort((a, b) => b.similarityScore - a.similarityScore);
}
