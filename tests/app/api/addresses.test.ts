import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../helpers/db";
import { property } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { FIXTURE_PROPERTIES } from "../../fixtures/properties";
import { handleAddressesRequest } from "@/app/api/addresses/logic";

describe("handleAddressesRequest", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(property).values(FIXTURE_PROPERTIES);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects an unauthenticated request", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleAddressesRequest(provider, "123", null);
    expect(result.status).toBe(401);
  });

  it("returns matching addresses for a signed-in request", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleAddressesRequest(provider, FIXTURE_PROPERTIES[0].unparsedAddress.slice(0, 4), "code-1");
    expect(result.status).toBe(200);
    expect((result.body as { matches: unknown[] }).matches.length).toBeGreaterThan(0);
  });

  it("returns no matches for an empty query instead of the whole table", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleAddressesRequest(provider, "", "code-1");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ matches: [] });
  });
});
