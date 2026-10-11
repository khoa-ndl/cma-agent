// DataProvider backed by the sample dataset (Release 1). Swap point: a
// future ResoWebApiProvider implements the same interface against a live
// MLS feed, with no change to callers (spec 2.1).
import { and, eq, gte, ilike, inArray, lte, ne } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { property } from "@/lib/db/schema";
import type { AddressMatch, DataProvider, ListingCriteria } from "./provider";
import { GENERATED_AS_OF } from "./generator";

const DEFAULT_SEARCH_LIMIT = 200;

export function createSampleDataProvider(db: Database): DataProvider {
  return {
    async searchAddresses(query, limit): Promise<AddressMatch[]> {
      // Escape ILIKE's own wildcards (% and _) so a literal underscore or
      // percent sign in the search text is matched literally, not as a
      // pattern. The trailing % we add ourselves is the only real wildcard.
      const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
      return db
        .select({
          listingKey: property.listingKey,
          unparsedAddress: property.unparsedAddress,
          city: property.city,
          mlsAreaMajor: property.mlsAreaMajor,
          latitude: property.latitude,
          longitude: property.longitude,
          propertySubType: property.propertySubType,
          bedroomsTotal: property.bedroomsTotal,
          bathroomsTotalInteger: property.bathroomsTotalInteger,
          livingArea: property.livingArea,
          lotSizeSquareFeet: property.lotSizeSquareFeet,
          yearBuilt: property.yearBuilt,
          garageSpaces: property.garageSpaces,
          propertyCondition: property.propertyCondition,
        })
        .from(property)
        .where(ilike(property.unparsedAddress, `${escaped}%`))
        .orderBy(property.unparsedAddress)
        .limit(limit);
    },

    async getProperty(listingKey) {
      const rows = await db.select().from(property).where(eq(property.listingKey, listingKey)).limit(1);
      return rows[0] ?? null;
    },

    async searchListings(criteria: ListingCriteria) {
      const conditions = [];
      if (criteria.statuses?.length) conditions.push(inArray(property.standardStatus, criteria.statuses));
      if (criteria.mlsAreaMajor) conditions.push(eq(property.mlsAreaMajor, criteria.mlsAreaMajor));
      if (criteria.propertySubType) conditions.push(eq(property.propertySubType, criteria.propertySubType));
      if (criteria.minLivingArea != null) conditions.push(gte(property.livingArea, criteria.minLivingArea));
      if (criteria.maxLivingArea != null) conditions.push(lte(property.livingArea, criteria.maxLivingArea));
      if (criteria.closedAfter) conditions.push(gte(property.closeDate, criteria.closedAfter));
      if (criteria.excludeListingKey) conditions.push(ne(property.listingKey, criteria.excludeListingKey));

      const query = db.select().from(property).limit(criteria.limit ?? DEFAULT_SEARCH_LIMIT);
      return conditions.length ? query.where(and(...conditions)) : query;
    },

    getAsOfDate: () => GENERATED_AS_OF,
  };
}
