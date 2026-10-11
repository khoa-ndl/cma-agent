import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { property } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import type { DataProvider } from "@/lib/data/provider";
import { FIXTURE_PROPERTIES } from "../fixtures/properties";

describe("SampleDataProvider", () => {
  let testDb: TestDb;
  let provider: DataProvider;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(property).values(FIXTURE_PROPERTIES);
    provider = createSampleDataProvider(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("searchAddresses", () => {
    it("matches by prefix", async () => {
      const results = await provider.searchAddresses("42", 10);
      expect(results.map((r) => r.listingKey)).toEqual(["FX-001"]);
    });

    it("is case-insensitive", async () => {
      const results = await provider.searchAddresses("4200 BALLARD", 10);
      expect(results.map((r) => r.listingKey)).toEqual(["FX-001"]);
    });

    it("does not match in the middle of the address", async () => {
      // "Ballard Ave NW" appears in two addresses, but neither starts
      // with it — this is a prefix match, not a contains search.
      const results = await provider.searchAddresses("Ballard Ave", 10);
      expect(results).toHaveLength(0);
    });

    it("respects the limit", async () => {
      const results = await provider.searchAddresses("", 1);
      expect(results).toHaveLength(1);
    });

    it("treats a literal underscore as a literal character, not a wildcard", async () => {
      // Unescaped, SQL ILIKE's "_" matches any single character, so
      // "4_00" would wrongly match "4200 Ballard Ave NW" (the "2").
      const results = await provider.searchAddresses("4_00", 10);
      expect(results).toHaveLength(0);
    });
  });

  describe("getProperty", () => {
    it("returns the matching property", async () => {
      const result = await provider.getProperty("FX-003");
      expect(result?.unparsedAddress).toBe("230 24th Ave NW");
    });

    it("returns null for an unknown key", async () => {
      expect(await provider.getProperty("does-not-exist")).toBeNull();
    });
  });

  describe("searchListings", () => {
    it("filters by status", async () => {
      const results = await provider.searchListings({ statuses: ["Active"] });
      expect(results.map((r) => r.listingKey).sort()).toEqual(["FX-003", "FX-004"]);
    });

    it("filters by area", async () => {
      const results = await provider.searchListings({ mlsAreaMajor: "Bellevue" });
      expect(results.map((r) => r.listingKey).sort()).toEqual(["FX-005", "FX-006"]);
    });

    it("filters by sub-type", async () => {
      const results = await provider.searchListings({ propertySubType: "Condominium" });
      expect(results.map((r) => r.listingKey)).toEqual(["FX-004"]);
    });

    it("filters by living area band", async () => {
      const results = await provider.searchListings({ minLivingArea: 1600, maxLivingArea: 2100 });
      expect(results.map((r) => r.listingKey).sort()).toEqual(["FX-001", "FX-002"]);
    });

    it("filters closed sales by close date, excluding listings with no close date", async () => {
      const results = await provider.searchListings({ closedAfter: "2026-06-01" });
      // FX-002 closed before the cutoff; FX-003/004/006 have no close date.
      expect(results.map((r) => r.listingKey).sort()).toEqual(["FX-001", "FX-005"]);
    });

    it("excludes the given listing key", async () => {
      const results = await provider.searchListings({ mlsAreaMajor: "Ballard", excludeListingKey: "FX-001" });
      expect(results.map((r) => r.listingKey).sort()).toEqual(["FX-002", "FX-003", "FX-004"]);
    });

    it("respects the limit", async () => {
      const results = await provider.searchListings({ limit: 2 });
      expect(results).toHaveLength(2);
    });
  });
});
