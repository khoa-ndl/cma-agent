// Validates one generated or imported property record against the RESO
// field set (spec 3.1). Reuses the enum value lists from the Drizzle
// schema — the database and the validator never drift apart.
import { z } from "zod";
import {
  propertyCondition,
  propertySubType,
  propertyType,
  standardStatus,
} from "@/lib/db/schema";

export const propertySchema = z.object({
  listingKey: z.string().min(1),
  listingId: z.string().min(1),
  standardStatus: z.enum(standardStatus.enumValues),
  propertyType: z.enum(propertyType.enumValues),
  propertySubType: z.enum(propertySubType.enumValues),
  unparsedAddress: z.string().min(1),
  city: z.string().min(1),
  stateOrProvince: z.string().length(2),
  postalCode: z.string().regex(/^\d{5}$/),
  mlsAreaMajor: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  bedroomsTotal: z.number().int().min(0),
  bathroomsTotalInteger: z.number().int().min(0),
  livingArea: z.number().int().positive(),
  // Null for condominiums (spec 3.1).
  lotSizeSquareFeet: z.number().int().positive().nullable(),
  yearBuilt: z.number().int().min(1800),
  garageSpaces: z.number().int().min(0),
  propertyCondition: z.enum(propertyCondition.enumValues),
  listPrice: z.number().int().positive(),
  originalListPrice: z.number().int().positive(),
  closePrice: z.number().int().positive().nullable(),
  listingContractDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  daysOnMarket: z.number().int().min(0),
});

export type GeneratedProperty = z.infer<typeof propertySchema>;
