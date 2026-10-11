import { describe, expect, it } from "vitest";
import { createTestDb } from "../../helpers/db";
import { checkHealth } from "@/app/api/health/logic";

describe("checkHealth", () => {
  it("returns 200 when the database responds", async () => {
    const testDb = await createTestDb();
    try {
      expect(await checkHealth(testDb.db)).toEqual({ status: 200, body: { status: "ok" } });
    } finally {
      await testDb.close();
    }
  });

  it("returns 503 when the database is unreachable", async () => {
    const testDb = await createTestDb();
    await testDb.close(); // queries against a closed PGlite instance reject, like an unreachable database
    expect(await checkHealth(testDb.db)).toEqual({ status: 503, body: { status: "unavailable" } });
  });
});
