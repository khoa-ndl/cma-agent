// Per-comp dollar adjustments (spec 4.1, 4.2): adjusts each comparable
// toward the subject, the standard appraisal convention — a line item is
// positive when the subject's value for that factor exceeds the comp's.
import { z } from "zod";
import type { Property } from "@/lib/data/provider";
import { propertyCondition, propertySubType } from "@/lib/db/schema";
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
  /** The dataset row this subject was pre-filled from, if any (address
   * autocomplete sets it; a freely-typed subject has none). Excluded from
   * its own comp search -- found in review: without this, the subject's
   * own sale could come back as a distance-0 "comp" for itself. Never
   * sent to the model (see loop.ts's buildInitialMessage). */
  sourceListingKey?: string;
}

// Validates subject facts from the API request body (spec 8: "structured
// property facts with validated types and ranges"). Shared with Step 9's
// UI form, so the browser and the server enforce the same bounds.
export const subjectInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  mlsAreaMajor: z.string().min(1),
  propertySubType: z.enum(propertySubType.enumValues),
  bedroomsTotal: z.number().int().min(0).max(20),
  bathroomsTotalInteger: z.number().int().min(0).max(20),
  livingArea: z.number().int().positive().max(50_000),
  lotSizeSquareFeet: z.number().int().positive().max(10_000_000).nullable(),
  yearBuilt: z.number().int().min(1800).max(2100),
  garageSpaces: z.number().int().min(0).max(20),
  propertyCondition: z.enum(propertyCondition.enumValues),
  sourceListingKey: z.string().min(1).optional(),
}) satisfies z.ZodType<Subject>;

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
