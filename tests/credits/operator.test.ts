import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "../helpers/db";
import { accessCodes, creditLedger, reports } from "@/lib/db/schema";
import { generateAccessCode, hashAccessCode } from "@/lib/credits/access";
import { createOperatorReport, ensureOperatorAccessCode, OPERATOR_CODE_LABEL } from "@/lib/credits/operator";

describe("ensureOperatorAccessCode", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("creates the sentinel on first use", async () => {
    const id = await ensureOperatorAccessCode(testDb.db);
    const [row] = await testDb.db.select().from(accessCodes).where(eq(accessCodes.id, id));
    expect(row.label).toBe(OPERATOR_CODE_LABEL);
    expect(row.creditsBalance).toBe(0);
  });

  it("reuses the same sentinel on a second call", async () => {
    const first = await ensureOperatorAccessCode(testDb.db);
    const second = await ensureOperatorAccessCode(testDb.db);
    expect(second).toBe(first);

    const rows = await testDb.db.select().from(accessCodes);
    expect(rows.filter((r) => r.label === OPERATOR_CODE_LABEL)).toHaveLength(1);
  });

  it("two truly concurrent calls still agree on exactly one sentinel", async () => {
    const [first, second] = await Promise.all([
      ensureOperatorAccessCode(testDb.db),
      ensureOperatorAccessCode(testDb.db),
    ]);
    expect(first).toBe(second);

    const rows = await testDb.db.select().from(accessCodes);
    expect(rows.filter((r) => r.label === OPERATOR_CODE_LABEL)).toHaveLength(1);
  });
});

describe("createOperatorReport", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("creates a running report attached to the sentinel", async () => {
    const result = await createOperatorReport(testDb.db, { mlsAreaMajor: "Ballard" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");

    const [row] = await testDb.db.select().from(reports).where(eq(reports.id, result.reportId));
    expect(row.status).toBe("running");

    const operatorId = await ensureOperatorAccessCode(testDb.db);
    expect(row.accessCodeId).toBe(operatorId);
  });

  it("never changes any other code's credits balance (D6)", async () => {
    const customerCode = generateAccessCode();
    const [inserted] = await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode(customerCode), label: "Customer", creditsBalance: 45 })
      .returning();

    await createOperatorReport(testDb.db, { mlsAreaMajor: "Ballard" });

    const [afterward] = await testDb.db.select().from(accessCodes).where(eq(accessCodes.id, inserted.id));
    expect(afterward.creditsBalance).toBe(45);
  });

  it("inserts no credit-ledger row", async () => {
    await createOperatorReport(testDb.db, { mlsAreaMajor: "Ballard" });
    const rows = await testDb.db.select().from(creditLedger);
    expect(rows).toHaveLength(0);
  });

  it("settles exactly one of two concurrent operator reports; the other returns already_running", async () => {
    const [first, second] = await Promise.all([
      createOperatorReport(testDb.db, { mlsAreaMajor: "Ballard" }),
      createOperatorReport(testDb.db, { mlsAreaMajor: "Ballard" }),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok && r.reason === "already_running")).toHaveLength(1);
  });

  it("allows a new operator report once the earlier one has finished", async () => {
    const first = await createOperatorReport(testDb.db, { mlsAreaMajor: "Ballard" });
    if (!first.ok) throw new Error("expected ok");
    await testDb.db.update(reports).set({ status: "succeeded" }).where(eq(reports.id, first.reportId));

    const second = await createOperatorReport(testDb.db, { mlsAreaMajor: "Fremont" });
    expect(second.ok).toBe(true);
  });
});
