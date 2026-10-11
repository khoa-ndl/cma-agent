import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../helpers/db";
import { accessCodes, reports } from "@/lib/db/schema";
import { listReports } from "@/app/api/reports/logic";

const CODE_A = "11111111-1111-1111-1111-111111111111";
const CODE_B = "22222222-2222-2222-2222-222222222222";

describe("listReports", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(accessCodes).values([
      { id: CODE_A, codeHash: "a", label: "a", creditsBalance: 40 },
      { id: CODE_B, codeHash: "b", label: "b", creditsBalance: 40 },
    ]);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects an unauthenticated request", async () => {
    const result = await listReports(testDb.db, null);
    expect(result).toEqual({ status: 401, body: { reason: "unauthenticated" } });
  });

  it("returns only the caller's own reports, newest first", async () => {
    await testDb.db.insert(reports).values({
      accessCodeId: CODE_A,
      status: "succeeded",
      subject: { mlsAreaMajor: "Ballard", unparsedAddress: "4200 Ballard Ave NW" },
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    await testDb.db.insert(reports).values({
      accessCodeId: CODE_A,
      status: "running",
      subject: { mlsAreaMajor: "Capitol Hill", unparsedAddress: "6510 10th Ave E" },
      createdAt: new Date("2026-10-05T00:00:00Z"),
    });
    await testDb.db.insert(reports).values({
      accessCodeId: CODE_B,
      status: "succeeded",
      subject: { mlsAreaMajor: "Fremont", unparsedAddress: "someone else's report" },
    });

    const result = await listReports(testDb.db, CODE_A);
    expect(result.status).toBe(200);
    const body = result.body as { reports: Array<{ unparsedAddress: string | null; status: string }> };
    expect(body.reports).toHaveLength(2);
    expect(body.reports[0].unparsedAddress).toBe("6510 10th Ave E"); // newest first
    expect(body.reports[1].unparsedAddress).toBe("4200 Ballard Ave NW");
  });

  it("falls back to the area when no address was stored (older reports)", async () => {
    await testDb.db.insert(reports).values({
      accessCodeId: CODE_A,
      status: "succeeded",
      subject: { mlsAreaMajor: "Ballard" },
    });

    const result = await listReports(testDb.db, CODE_A);
    const body = result.body as { reports: Array<{ unparsedAddress: string | null; mlsAreaMajor: string | null }> };
    expect(body.reports[0].unparsedAddress).toBeNull();
    expect(body.reports[0].mlsAreaMajor).toBe("Ballard");
  });

  it("caps the result at an optional limit, still newest first (end-user home page)", async () => {
    const areas: [string, string][] = [
      ["Ballard", "2026-10-01T00:00:00Z"],
      ["Fremont", "2026-10-03T00:00:00Z"],
      ["Capitol Hill", "2026-10-05T00:00:00Z"],
    ];
    for (const [area, createdAt] of areas) {
      await testDb.db
        .insert(reports)
        .values({ accessCodeId: CODE_A, status: "succeeded", subject: { mlsAreaMajor: area }, createdAt: new Date(createdAt) });
    }

    const result = await listReports(testDb.db, CODE_A, 2);
    const body = result.body as { reports: Array<{ mlsAreaMajor: string | null }> };
    expect(body.reports).toHaveLength(2);
    expect(body.reports[0].mlsAreaMajor).toBe("Capitol Hill"); // newest first
  });
});
