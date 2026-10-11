// The single interface the agent and UI use to read property data (spec 2).
// SampleDataProvider (this release) and a future ResoWebApiProvider (a live
// MLS feed) both implement this; nothing else in the app queries the
// property table directly.
import type { property } from "@/lib/db/schema";

export type Property = typeof property.$inferSelect;

// Carries every fact the "New CMA" form pre-fills (spec 5 screen 2) —
// everything Subject needs.
export interface AddressMatch {
  listingKey: string;
  unparsedAddress: string;
  city: string;
  mlsAreaMajor: string;
  latitude: number;
  longitude: number;
  propertySubType: Property["propertySubType"];
  bedroomsTotal: number;
  bathroomsTotalInteger: number;
  livingArea: number;
  lotSizeSquareFeet: number | null;
  yearBuilt: number;
  garageSpaces: number;
  propertyCondition: Property["propertyCondition"];
}

export interface ListingCriteria {
  statuses?: Property["standardStatus"][];
  mlsAreaMajor?: string;
  propertySubType?: Property["propertySubType"];
  minLivingArea?: number;
  maxLivingArea?: number;
  /**
   * Only Closed listings with closeDate on or after this ISO date.
   * Active/Pending listings have no closeDate, so this filter excludes
   * them too — combine criteria in separate calls if a comp search needs
   * both recent closed sales and current listings (Step 5's job, not this
   * interface's).
   */
  closedAfter?: string;
  excludeListingKey?: string;
  limit?: number;
}

export interface DataProvider {
  searchAddresses(query: string, limit: number): Promise<AddressMatch[]>;
  getProperty(listingKey: string): Promise<Property | null>;
  searchListings(criteria: ListingCriteria): Promise<Property[]>;
  /**
   * What "now" means for this data source — the reference point
   * "trailing N months" searches measure back from. A live MLS feed
   * would return the real current time; the sample dataset returns its
   * own fixed generation date, so "recent" sales stay well-defined no
   * matter how long after generation the app is actually run.
   */
  getAsOfDate(): Date;
}
