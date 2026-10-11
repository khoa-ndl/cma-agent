import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, type TestDb } from "../helpers/db";
import { accessCodes, creditLedger, reports } from "@/lib/db/schema";
import { reserveCredits, refundCredits, sweepStaleRuns, REPORT_COST } from "@/lib/credits/credits";

async function makeAccessCode(testDb: TestDb, creditsBalance: number) {
  const [code] = await testDb.db
    .insert(accessCodes)
    .values({ codeHash: `hash-${Math.random()}`, label: "Test", creditsBalance })
    .returning();
  return code;
}

describe("reserveCredits / refundCredits (A8)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("deducts the report cost and creates a running report", async () => {
    const code = await makeAccessCode(testDb, 45);
    const result = await reserveCredits(testDb.db, code.id, { address: "1 Test St" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.remainingBalance).toBe(45 - REPORT_COST);

    const [report] = await testDb.db.select().from(reports).where(sql`${reports.id} = ${result.reportId}`);
    expect(report.status).toBe("running");

    const [entry] = await testDb.db
      .select()
      .from(creditLedger)
      .where(sql`${creditLedger.reportId} = ${result.reportId}`);
    expect(entry.delta).toBe(-REPORT_COST);
    expect(entry.reason).toBe("report");
  });

  it("refunds a failed run and restores the balance", async () => {
    const code = await makeAccessCode(testDb, 45);
    const result = await reserveCredits(testDb.db, code.id, {});
    if (!result.ok) throw new Error("expected success");

    await refundCredits(testDb.db, result.reportId);

    const [refunded] = await testDb.db.select().from(accessCodes).where(sql`${accessCodes.id} = ${code.id}`);
    expect(refunded.creditsBalance).toBe(45);

    const [report] = await testDb.db.select().from(reports).where(sql`${reports.id} = ${result.reportId}`);
    expect(report.status).toBe("failed");

    const refundEntries = await testDb.db
      .select()
      .from(creditLedger)
      .where(sql`${creditLedger.reportId} = ${result.reportId} AND ${creditLedger.reason} = 'refund'`);
    expect(refundEntries).toHaveLength(1);
    expect(refundEntries[0].delta).toBe(REPORT_COST);
  });

  it("does not double-refund a report that's already finished", async () => {
    const code = await makeAccessCode(testDb, 45);
    const result = await reserveCredits(testDb.db, code.id, {});
    if (!result.ok) throw new Error("expected success");

    await refundCredits(testDb.db, result.reportId);
    await refundCredits(testDb.db, result.reportId); // second call: must be a no-op

    const [refunded] = await testDb.db.select().from(accessCodes).where(sql`${accessCodes.id} = ${code.id}`);
    expect(refunded.creditsBalance).toBe(45); // not 50
  });
});

describe("reserveCredits (A9: one running report per code)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a second reservation while one is already running, and leaves the balance unchanged", async () => {
    const code = await makeAccessCode(testDb, 45);
    const first = await reserveCredits(testDb.db, code.id, {});
    expect(first.ok).toBe(true);

    const second = await reserveCredits(testDb.db, code.id, {});
    expect(second).toEqual({ ok: false, reason: "already_running" });

    const [afterSecond] = await testDb.db.select().from(accessCodes).where(sql`${accessCodes.id} = ${code.id}`);
    expect(afterSecond.creditsBalance).toBe(45 - REPORT_COST); // deducted once, not twice
  });

  it("settles exactly one of two truly concurrent reservations for the same code", async () => {
    // Note: PGlite is single-process, so this can't fully stand in for
    // two separate Neon connections genuinely racing — that guarantee
    // comes from Postgres's row locking on the access_codes UPDATE. This
    // still proves the call pattern a real double-click would produce.
    const code = await makeAccessCode(testDb, 45);
    const [first, second] = await Promise.all([
      reserveCredits(testDb.db, code.id, {}),
      reserveCredits(testDb.db, code.id, {}),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok && r.reason === "already_running")).toHaveLength(1);

    const [afterBoth] = await testDb.db.select().from(accessCodes).where(sql`${accessCodes.id} = ${code.id}`);
    expect(afterBoth.creditsBalance).toBe(45 - REPORT_COST);
  });
});

describe("reserveCredits (A10: insufficient balance, revoked code)", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a reservation when the balance is below the report cost", async () => {
    const code = await makeAccessCode(testDb, 3); // less than REPORT_COST (5)
    const result = await reserveCredits(testDb.db, code.id, {});
    expect(result).toEqual({ ok: false, reason: "insufficient_credits" });

    const [unchanged] = await testDb.db.select().from(accessCodes).where(sql`${accessCodes.id} = ${code.id}`);
    expect(unchanged.creditsBalance).toBe(3);
  });

  it("rejects a reservation on a revoked code", async () => {
    const [code] = await testDb.db
      .insert(accessCodes)
      .values({ codeHash: "revoked-hash", label: "Test", creditsBalance: 45, revokedAt: new Date() })
      .returning();

    const result = await reserveCredits(testDb.db, code.id, {});
    expect(result).toEqual({ ok: false, reason: "revoked_or_not_found" });
  });
});

describe("sweepStaleRuns", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("fails and refunds a report that has been running too long", async () => {
    const code = await makeAccessCode(testDb, 40); // already down 5 from a prior reservation
    const [staleReport] = await testDb.db
      .insert(reports)
      .values({ accessCodeId: code.id, status: "running", subject: {} })
      .returning();
    // Back-date it past the staleness threshold directly in the database,
    // rather than waiting for real time to pass.
    await testDb.db.execute(
      sql`UPDATE reports SET created_at = now() - interval '10 minutes' WHERE id = ${staleReport.id}`,
    );

    await sweepStaleRuns(testDb.db);

    const [swept] = await testDb.db.select().from(reports).where(sql`${reports.id} = ${staleReport.id}`);
    expect(swept.status).toBe("failed");

    const [refunded] = await testDb.db.select().from(accessCodes).where(sql`${accessCodes.id} = ${code.id}`);
    expect(refunded.creditsBalance).toBe(45);
  });

  it("a stale run does not block a brand new reservation", async () => {
    const code = await makeAccessCode(testDb, 40);
    const [staleReport] = await testDb.db
      .insert(reports)
      .values({ accessCodeId: code.id, status: "running", subject: {} })
      .returning();
    await testDb.db.execute(
      sql`UPDATE reports SET created_at = now() - interval '10 minutes' WHERE id = ${staleReport.id}`,
    );

    // reserveCredits sweeps stale runs before reserving — this must
    // succeed, not report "already_running".
    const result = await reserveCredits(testDb.db, code.id, {});
    expect(result.ok).toBe(true);
  });

  it("leaves a recent running report alone", async () => {
    const code = await makeAccessCode(testDb, 40);
    const [recentReport] = await testDb.db
      .insert(reports)
      .values({ accessCodeId: code.id, status: "running", subject: {} })
      .returning();

    await sweepStaleRuns(testDb.db);

    const [unchanged] = await testDb.db.select().from(reports).where(sql`${reports.id} = ${recentReport.id}`);
    expect(unchanged.status).toBe("running");
  });
});
