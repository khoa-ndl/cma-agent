import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../helpers/db";
import { accessCodes, reports } from "@/lib/db/schema";
import { listAllReports } from "@/app/api/admin/reports/logic";
import { createOperatorReport } from "@/lib/credits/operator";

const CODE_A = "11111111-1111-1111-1111-111111111111";

describe("listAllReports", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(accessCodes).values({ id: CODE_A, codeHash: "a", label: "Customer A", creditsBalance: 40 });
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const result = await listAllReports(testDb.db, false);
    expect(result).toEqual({ status: 401, body: { reason: "unauthenticated" } });
  });

  it("lists both customer and operator reports, newest first, with the sentinel labeled Operator", async () => {
    await testDb.db.insert(reports).values({
      accessCodeId: CODE_A,
      status: "succeeded",
      subject: { mlsAreaMajor: "Ballard", unparsedAddress: "4200 Ballard Ave NW" },
      createdAt: new Date("2026-10-01T00:00:00Z"),
    });
    await createOperatorReport(testDb.db, { mlsAreaMajor: "Fremont" });

    const result = await listAllReports(testDb.db, true);
    expect(result.status).toBe(200);
    const body = result.body as { reports: Array<{ codeLabel: string; unparsedAddress: string | null }> };
    expect(body.reports).toHaveLength(2);
    expect(body.reports[0].codeLabel).toBe("Operator"); // newest first
    expect(body.reports[1].codeLabel).toBe("Customer A");
    expect(body.reports[1].unparsedAddress).toBe("4200 Ballard Ave NW");
  });

  it("caps the list at 200 rows", async () => {
    const rows = Array.from({ length: 205 }, () => ({
      accessCodeId: CODE_A,
      status: "succeeded" as const,
      subject: { mlsAreaMajor: "Ballard" },
    }));
    for (const row of rows) {
      await testDb.db.insert(reports).values(row);
    }

    const result = await listAllReports(testDb.db, true);
    const body = result.body as { reports: unknown[] };
    expect(body.reports).toHaveLength(200);
  });
});
