import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "../../../helpers/db";
import { accessCodes, reports } from "@/lib/db/schema";
import { getAdminOverview } from "@/app/api/admin/overview/logic";
import { createOperatorReport } from "@/lib/credits/operator";

const CODE_A = "11111111-1111-1111-1111-111111111111";
const CODE_B = "22222222-2222-2222-2222-222222222222";

describe("getAdminOverview", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const result = await getAdminOverview(testDb.db, false);
    expect(result).toEqual({ status: 401, body: { reason: "unauthenticated" } });
  });

  it("reports the database as healthy", async () => {
    const result = await getAdminOverview(testDb.db, true);
    expect(result.status).toBe(200);
    const body = result.body as { health: string };
    expect(body.health).toBe("ok");
  });

  it("lists a report stuck past the stale threshold, with its age and code label", async () => {
    await testDb.db.insert(accessCodes).values({ id: CODE_A, codeHash: "a", label: "Jane", creditsBalance: 45 });
    await testDb.db.insert(reports).values({
      accessCodeId: CODE_A,
      status: "running",
      subject: {},
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago, past the 5-min threshold
    });

    const result = await getAdminOverview(testDb.db, true);
    const body = result.body as { stuckReports: Array<{ codeLabel: string; ageMinutes: number }> };
    expect(body.stuckReports).toHaveLength(1);
    expect(body.stuckReports[0].codeLabel).toBe("Jane");
    expect(body.stuckReports[0].ageMinutes).toBeGreaterThanOrEqual(10);
  });

  it("doesn't list a report that's still within the stale threshold", async () => {
    await testDb.db.insert(accessCodes).values({ id: CODE_A, codeHash: "a", label: "Jane", creditsBalance: 45 });
    await testDb.db.insert(reports).values({ accessCodeId: CODE_A, status: "running", subject: {} });

    const result = await getAdminOverview(testDb.db, true);
    const body = result.body as { stuckReports: unknown[] };
    expect(body.stuckReports).toHaveLength(0);
  });

  it("sums customer and operator spend together for the monthly total (D7)", async () => {
    await testDb.db.insert(accessCodes).values({ id: CODE_A, codeHash: "a", label: "Jane", creditsBalance: 45 });
    await testDb.db.insert(reports).values({
      accessCodeId: CODE_A,
      status: "succeeded",
      subject: {},
      costUsd: "0.05",
    });

    const operatorReport = await createOperatorReport(testDb.db, {});
    if (!operatorReport.ok) throw new Error("expected ok");
    await testDb.db
      .update(reports)
      .set({ status: "succeeded", costUsd: "0.03" })
      .where(eq(reports.id, operatorReport.reportId));

    const result = await getAdminOverview(testDb.db, true);
    const body = result.body as { monthlySpendUsd: number };
    expect(body.monthlySpendUsd).toBeCloseTo(0.08, 5);
  });

  it("lists codes below one report's cost, excluding the operator sentinel", async () => {
    await testDb.db.insert(accessCodes).values([
      { id: CODE_A, codeHash: "a", label: "Low", creditsBalance: 2 },
      { id: CODE_B, codeHash: "b", label: "Plenty", creditsBalance: 45 },
    ]);
    await createOperatorReport(testDb.db, {}); // creates the sentinel, with a 0 balance

    const result = await getAdminOverview(testDb.db, true);
    const body = result.body as { lowBalanceCodes: Array<{ label: string }> };
    expect(body.lowBalanceCodes.map((c) => c.label)).toEqual(["Low"]);
  });
});
