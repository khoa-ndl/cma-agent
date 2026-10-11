// A2: one typical subject per area must yield at least 5 closed comps
// on the full seed dataset — not the small fixture other engine tests
// use. Loads all 1,500 generated records once and reuses them across
// all 10 areas, since re-inserting per test would be needlessly slow.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { property } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { searchCandidates } from "@/lib/engine/search";
import type { Subject } from "@/lib/engine/adjustments";
import { AREAS, GENERATED_AS_OF } from "@/lib/data/generator";

const CHUNK_SIZE = 200;

describe("searchCandidates density across the full seed dataset (A2)", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
    const records = JSON.parse(readFileSync("data/seed/properties.json", "utf8"));
    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      await testDb.db.insert(property).values(records.slice(i, i + CHUNK_SIZE));
    }
  }, 30000);

  afterAll(async () => {
    await testDb.close();
  });

  it.each(AREAS.map((area) => area.name))("yields at least 5 closed comps in %s", async (areaName) => {
    const provider = createSampleDataProvider(testDb.db);

    // "A typical subject" is the median-sized closed sale in the area —
    // not whichever row happens to come back first, which could be an
    // unusually large or small outlier. Excluded from its own results.
    const closedInArea = await provider.searchListings({
      mlsAreaMajor: areaName,
      statuses: ["Closed"],
      limit: 200,
    });
    expect(closedInArea.length).toBeGreaterThan(0);
    closedInArea.sort((a, b) => a.livingArea - b.livingArea);
    const sample = closedInArea[Math.floor(closedInArea.length / 2)];

    const subject: Subject = {
      latitude: sample.latitude,
      longitude: sample.longitude,
      mlsAreaMajor: sample.mlsAreaMajor,
      propertySubType: sample.propertySubType,
      bedroomsTotal: sample.bedroomsTotal,
      bathroomsTotalInteger: sample.bathroomsTotalInteger,
      livingArea: sample.livingArea,
      lotSizeSquareFeet: sample.lotSizeSquareFeet,
      yearBuilt: sample.yearBuilt,
      garageSpaces: sample.garageSpaces,
      propertyCondition: sample.propertyCondition,
    };

    const candidates = await searchCandidates(provider, subject, {
      radiusMiles: 2,
      monthsBack: 12,
      sizeBandPercent: 20,
      statuses: ["Closed"],
      asOf: GENERATED_AS_OF,
      excludeListingKey: sample.listingKey,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(5);
  });
});
