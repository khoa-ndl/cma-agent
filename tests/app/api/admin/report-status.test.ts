import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../helpers/db";
import { accessCodes, reports } from "@/lib/db/schema";
import { getAdminReport } from "@/app/api/admin/reports/[id]/logic";

const CODE_A = "11111111-1111-1111-1111-111111111111";

describe("getAdminReport", () => {
  let testDb: TestDb;
  let reportId: string;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(accessCodes).values({ id: CODE_A, codeHash: "a", label: "a", creditsBalance: 40 });
    const [row] = await testDb.db
      .insert(reports)
      .values({ accessCodeId: CODE_A, status: "succeeded", subject: { mlsAreaMajor: "Ballard" }, result: { rationale: "x" } })
      .returning();
    reportId = row.id;
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const result = await getAdminReport(testDb.db, reportId, false);
    expect(result.status).toBe(401);
  });

  it("returns any report, regardless of which code owns it", async () => {
    const result = await getAdminReport(testDb.db, reportId, true);
    expect(result.status).toBe(200);
    expect((result.body as { status: string }).status).toBe("succeeded");
  });

  it("returns 404 for a report id that doesn't exist", async () => {
    const result = await getAdminReport(testDb.db, "00000000-0000-0000-0000-000000000000", true);
    expect(result.status).toBe(404);
  });
});
