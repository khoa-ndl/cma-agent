import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { accessAttempts, adminLoginAttempts } from "@/lib/db/schema";
import { checkAdminLogin } from "@/lib/admin/login";

const IP = "203.0.113.1";
const CORRECT_PASSWORD = "correct-horse-battery-staple";

describe("checkAdminLogin", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("accepts the correct password", async () => {
    const result = await checkAdminLogin(testDb.db, CORRECT_PASSWORD, IP, CORRECT_PASSWORD);
    expect(result).toEqual({ ok: true });
  });

  it("rejects the wrong password", async () => {
    const result = await checkAdminLogin(testDb.db, "wrong-password", IP, CORRECT_PASSWORD);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rate-limits an IP after 10 failures, without checking a correct password in the meantime", async () => {
    for (let i = 0; i < 10; i++) {
      await checkAdminLogin(testDb.db, "wrong-password", IP, CORRECT_PASSWORD);
    }

    const result = await checkAdminLogin(testDb.db, CORRECT_PASSWORD, IP, CORRECT_PASSWORD);
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("does not rate-limit a different IP", async () => {
    for (let i = 0; i < 10; i++) {
      await checkAdminLogin(testDb.db, "wrong-password", IP, CORRECT_PASSWORD);
    }

    const result = await checkAdminLogin(testDb.db, CORRECT_PASSWORD, "203.0.113.2", CORRECT_PASSWORD);
    expect(result).toEqual({ ok: true });
  });

  it("hammering admin login doesn't trip the end-user rate limiter for the same IP (D10)", async () => {
    for (let i = 0; i < 10; i++) {
      await checkAdminLogin(testDb.db, "wrong-password", IP, CORRECT_PASSWORD);
    }

    const rows = await testDb.db.select().from(accessAttempts);
    expect(rows).toHaveLength(0);
  });

  it("every attempt is recorded in admin_login_attempts, not access_attempts", async () => {
    await checkAdminLogin(testDb.db, CORRECT_PASSWORD, IP, CORRECT_PASSWORD);
    await checkAdminLogin(testDb.db, "wrong-password", IP, CORRECT_PASSWORD);

    const rows = await testDb.db.select().from(adminLoginAttempts);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.succeeded)).toHaveLength(1);
  });
});
