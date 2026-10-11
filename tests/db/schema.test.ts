import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { accessCodes, accessAttempts, creditLedger, property, reports } from "@/lib/db/schema";

describe("database schema", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("creates every table via migrations (A16: runs on plain Postgres)", async () => {
    const { db } = testDb;
    await expect(db.select().from(property)).resolves.toEqual([]);
    await expect(db.select().from(accessCodes)).resolves.toEqual([]);
    await expect(db.select().from(reports)).resolves.toEqual([]);
    await expect(db.select().from(creditLedger)).resolves.toEqual([]);
    await expect(db.select().from(accessAttempts)).resolves.toEqual([]);
  });

  it("rejects a second running report for the same access code (A9)", async () => {
    const { db } = testDb;
    const [code] = await db
      .insert(accessCodes)
      .values({ codeHash: "hash-1", label: "Test agent", creditsBalance: 45 })
      .returning();

    await db.insert(reports).values({ accessCodeId: code.id, status: "running", subject: {} });

    await expect(
      db.insert(reports).values({ accessCodeId: code.id, status: "running", subject: {} }),
    ).rejects.toThrow();
  });

  it("allows a new report once the earlier one has finished", async () => {
    const { db } = testDb;
    const [code] = await db
      .insert(accessCodes)
      .values({ codeHash: "hash-2", label: "Test agent", creditsBalance: 45 })
      .returning();

    await db.insert(reports).values({ accessCodeId: code.id, status: "succeeded", subject: {} });
    await db.insert(reports).values({ accessCodeId: code.id, status: "failed", subject: {} });

    // Neither is "running", so the partial unique index does not apply —
    // this must not throw.
    await db.insert(reports).values({ accessCodeId: code.id, status: "running", subject: {} });
  });

  it("rejects a negative credit balance (defense in depth for Step 6)", async () => {
    const { db } = testDb;
    await expect(
      db.insert(accessCodes).values({ codeHash: "hash-3", label: "Test agent", creditsBalance: -1 }),
    ).rejects.toThrow();
  });
});
