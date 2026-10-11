import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../helpers/db";
import { accessCodes, reports } from "@/lib/db/schema";
import { getReport } from "@/app/api/reports/[id]/logic";

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
});
