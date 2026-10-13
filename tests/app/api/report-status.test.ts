import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../helpers/db";
import { accessCodes, property, reports } from "@/lib/db/schema";
import { getReport } from "@/app/api/reports/[id]/logic";
import { FIXTURE_PROPERTIES } from "../../fixtures/properties";

const CODE_A = "11111111-1111-1111-1111-111111111111";
const CODE_B = "22222222-2222-2222-2222-222222222222";

describe("getReport", () => {
  let testDb: TestDb;
  let reportId: string;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(accessCodes).values([
      { id: CODE_A, codeHash: "a", label: "a", creditsBalance: 40 },
      { id: CODE_B, codeHash: "b", label: "b", creditsBalance: 40 },
    ]);
    const [row] = await testDb.db
      .insert(reports)
      .values({ accessCodeId: CODE_A, status: "succeeded", subject: { mlsAreaMajor: "Ballard" }, result: { rationale: "x" } })
      .returning();
    reportId = row.id;
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects an unauthenticated request", async () => {
    const result = await getReport(testDb.db, reportId, null);
    expect(result.status).toBe(401);
  });

  it("returns the report for the code that owns it", async () => {
    const result = await getReport(testDb.db, reportId, CODE_A);
    expect(result.status).toBe(200);
    expect((result.body as { status: string }).status).toBe("succeeded");
  });

  it("returns 404 for a report owned by a different code, instead of 403", async () => {
    const result = await getReport(testDb.db, reportId, CODE_B);
    expect(result.status).toBe(404);
  });

  it("returns 404 for a report id that doesn't exist", async () => {
    const result = await getReport(testDb.db, "00000000-0000-0000-0000-000000000000", CODE_A);
    expect(result.status).toBe(404);
  });

  describe("mapPositions", () => {
    beforeEach(async () => {
      await testDb.db.insert(property).values(FIXTURE_PROPERTIES);
    });

    it("includes map positions looked up from the property table, by listingKey, for a succeeded report", async () => {
      const [row] = await testDb.db
        .insert(reports)
        .values({
          accessCodeId: CODE_A,
          status: "succeeded",
          subject: { mlsAreaMajor: "Ballard", sourceListingKey: "FX-005" },
          result: {
            rationale: "x",
            selectedComps: [
              { listingKey: "FX-001", weight: 1 },
              { listingKey: "FX-002", weight: 2 },
            ],
          },
        })
        .returning();

      const result = await getReport(testDb.db, row.id, CODE_A);
      const body = result.body as {
        mapPositions?: {
          subject: { latitude: number; longitude: number } | null;
          comps: Array<{ listingKey: string; latitude: number; longitude: number }>;
        };
      };

      expect(body.mapPositions?.comps).toHaveLength(2);
      expect(body.mapPositions?.comps).toContainEqual({
        listingKey: "FX-001",
        latitude: 47.67,
        longitude: -122.38,
      });
      expect(body.mapPositions?.comps).toContainEqual({
        listingKey: "FX-002",
        latitude: 47.67,
        longitude: -122.38,
      });
      expect(body.mapPositions?.subject).toEqual({ latitude: 47.67, longitude: -122.38 });
    });

    it("omits a comp from mapPositions if its listingKey is no longer in property, without throwing (Review Focus #5)", async () => {
      const [row] = await testDb.db
        .insert(reports)
        .values({
          accessCodeId: CODE_A,
          status: "succeeded",
          subject: { mlsAreaMajor: "Ballard" },
          result: {
            rationale: "x",
            selectedComps: [
              { listingKey: "FX-001", weight: 1 },
              { listingKey: "GHOST-404", weight: 1 },
            ],
          },
        })
        .returning();

      const result = await getReport(testDb.db, row.id, CODE_A);
      expect(result.status).toBe(200);
      const body = result.body as { mapPositions?: { comps: Array<{ listingKey: string }> } };
      expect(body.mapPositions?.comps.map((c) => c.listingKey)).toEqual(["FX-001"]);
    });

    it("sets mapPositions.subject to null when the report has no sourceListingKey or it's missing from property", async () => {
      const [noSource] = await testDb.db
        .insert(reports)
        .values({
          accessCodeId: CODE_A,
          status: "succeeded",
          subject: { mlsAreaMajor: "Ballard" },
          result: { rationale: "x", selectedComps: [{ listingKey: "FX-001", weight: 1 }] },
        })
        .returning();
      const noSourceResult = await getReport(testDb.db, noSource.id, CODE_A);
      expect((noSourceResult.body as { mapPositions?: { subject: unknown } }).mapPositions?.subject).toBeNull();

      const [badSource] = await testDb.db
        .insert(reports)
        .values({
          accessCodeId: CODE_A,
          status: "succeeded",
          subject: { mlsAreaMajor: "Ballard", sourceListingKey: "GHOST-404" },
          result: { rationale: "x", selectedComps: [{ listingKey: "FX-001", weight: 1 }] },
        })
        .returning();
      const badSourceResult = await getReport(testDb.db, badSource.id, CODE_A);
      expect((badSourceResult.body as { mapPositions?: { subject: unknown } }).mapPositions?.subject).toBeNull();
    });

    it("does not populate mapPositions for a running report", async () => {
      const [row] = await testDb.db
        .insert(reports)
        .values({ accessCodeId: CODE_A, status: "running", subject: { mlsAreaMajor: "Ballard" } })
        .returning();

      const result = await getReport(testDb.db, row.id, CODE_A);
      expect((result.body as { mapPositions?: unknown }).mapPositions).toBeUndefined();
    });
  });
});
