// Weighted value range and suggested list price from a set of already-
// adjusted comparable values (spec 4.1). Comp selection and weighting
// judgment belong to the agent (Step 7); this just does the arithmetic.
export interface PricedComparable {
  listingKey: string;
  adjustedValue: number;
  /** Relative weight in the suggested price; defaults to 1 (equal). */
  weight?: number;
}

export interface PriceRange {
  low: number;
  high: number;
  suggestedListPrice: number;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function computePriceRange(comps: PricedComparable[]): PriceRange {
  if (comps.length === 0) {
    throw new Error("computePriceRange requires at least one comparable");
  }

  const values = comps.map((c) => c.adjustedValue);
  const totalWeight = comps.reduce((sum, c) => sum + (c.weight ?? 1), 0);
  const weightedSum = comps.reduce((sum, c) => sum + c.adjustedValue * (c.weight ?? 1), 0);

  return {
    low: roundTo(Math.min(...values), 1000),
    high: roundTo(Math.max(...values), 1000),
    suggestedListPrice: roundTo(weightedSum / totalWeight, 1000),
  };
}
