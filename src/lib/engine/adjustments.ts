// Per-comp dollar adjustments (spec 4.1, 4.2): adjusts each comparable
// toward the subject, the standard appraisal convention — a line item is
// positive when the subject's value for that factor exceeds the comp's.
import type { Property } from "@/lib/data/provider";
import type { AdjustmentRates } from "./config";

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;
const CONDITION_RANK: Record<Property["propertyCondition"], number> = {
  Poor: 0,
  Fair: 1,
  Good: 2,
  Excellent: 3,
};

/** The physical facts of the property under analysis — not a Property
 * row, since the subject need not exist in the dataset (spec 5: address
 * autocomplete pre-fills these, all editable). */
export interface Subject {
  latitude: number;
  longitude: number;
  mlsAreaMajor: string;
  propertySubType: Property["propertySubType"];
  bedroomsTotal: number;
  bathroomsTotalInteger: number;
  livingArea: number;
  lotSizeSquareFeet: number | null;
  yearBuilt: number;
  garageSpaces: number;
  propertyCondition: Property["propertyCondition"];
}

export interface AdjustmentLineItem {
  factor:
    | "livingArea"
    | "bedrooms"
    | "bathrooms"
    | "garageSpaces"
    | "lotSize"
    | "age"
    | "condition"
    | "marketTime";
  amount: number;
}

export interface ComparableAdjustment {
  listingKey: string;
  basePrice: number;
  lineItems: AdjustmentLineItem[];
  totalAdjustment: number;
  adjustedValue: number;
}

export function computeAdjustments(
  subject: Subject,
  comp: Property,
  rates: AdjustmentRates,
  asOf: Date,
): ComparableAdjustment {
  // Lot size only makes sense to compare when both sides have one — a
  // condo's lot is null, not zero, so this isn't a size-20,000-sqft comp.
  const lotSizeAmount =
    subject.lotSizeSquareFeet != null && comp.lotSizeSquareFeet != null
      ? (subject.lotSizeSquareFeet - comp.lotSizeSquareFeet) * rates.lotSizePerSqft
      : 0;

  const basePrice = comp.closePrice ?? comp.listPrice;
  const monthsSinceClose = comp.closeDate
    ? (asOf.getTime() - new Date(comp.closeDate).getTime()) / MS_PER_MONTH
    : 0;

  // Each line item is rounded to the nearest dollar before the total is
  // computed, so a printed adjustment grid always sums to its own total —
  // rounding after summing can leave the two a dollar or two apart.
  const rawLineItems: AdjustmentLineItem[] = [
    { factor: "livingArea", amount: (subject.livingArea - comp.livingArea) * rates.livingAreaPerSqft },
    { factor: "bedrooms", amount: (subject.bedroomsTotal - comp.bedroomsTotal) * rates.bedroom },
    {
      factor: "bathrooms",
      amount: (subject.bathroomsTotalInteger - comp.bathroomsTotalInteger) * rates.bathroom,
    },
    { factor: "garageSpaces", amount: (subject.garageSpaces - comp.garageSpaces) * rates.garageSpace },
    { factor: "lotSize", amount: lotSizeAmount },
    { factor: "age", amount: ((subject.yearBuilt - comp.yearBuilt) / 10) * rates.agePerDecade },
    {
      factor: "condition",
      amount:
        (CONDITION_RANK[subject.propertyCondition] - CONDITION_RANK[comp.propertyCondition]) *
        rates.conditionStep,
    },
    { factor: "marketTime", amount: basePrice * rates.marketTimePerMonth * monthsSinceClose },
  ];
  const lineItems = rawLineItems.map((item) => ({ ...item, amount: Math.round(item.amount) }));

  const totalAdjustment = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    listingKey: comp.listingKey,
    basePrice,
    lineItems,
    totalAdjustment,
    adjustedValue: basePrice + totalAdjustment,
  };
}
