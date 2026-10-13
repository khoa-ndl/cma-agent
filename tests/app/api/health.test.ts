import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../helpers/db";
import { checkHealth } from "@/app/api/health/logic";

describe("checkHealth", () => {
  // Found in review: createTestDb() used to run inside each it() itself,
  // getting vitest's 5s default test timeout instead of the 10s hook
  // timeout every other file's beforeEach gets for the same PGlite boot --
  // the narrower of this project's two createTestDb()-under-load flakes
  // (the other was the maxWorkers fix in vitest.config.mts).
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    // The second test below closes testDb itself (that's the point of
    // it); closing an already-closed PGlite instance throws, so this is
    // a no-op in that case, not a leak -- there's nothing left open.
    try {
      await testDb.close();
    } catch {
      // already closed by the test itself
    }
  });

  it("returns 200 when the database responds", async () => {
    expect(await checkHealth(testDb.db)).toEqual({ status: 200, body: { status: "ok" } });
  });

  it("returns 503 when the database is unreachable", async () => {
    await testDb.close(); // queries against a closed PGlite instance reject, like an unreachable database
    expect(await checkHealth(testDb.db)).toEqual({ status: 503, body: { status: "unavailable" } });
  });
});
