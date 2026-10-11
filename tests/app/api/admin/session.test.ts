import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../helpers/db";
import { verifyAdminSessionToken } from "@/lib/admin/session";
import { handleAdminLogin } from "@/app/api/admin/session/logic";

const SECRET = "test-secret";
const CORRECT_PASSWORD = "correct-horse-battery-staple";
const IP = "203.0.113.5";

describe("handleAdminLogin", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("sets a valid admin session token for the correct password", async () => {
    const result = await handleAdminLogin(testDb.db, { password: CORRECT_PASSWORD }, IP, SECRET, CORRECT_PASSWORD);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.sessionToken).toBeDefined();
    expect(verifyAdminSessionToken(result.sessionToken!, SECRET)).toEqual({ kind: "admin" });
  });

  it("rejects a malformed request body", async () => {
    const result = await handleAdminLogin(testDb.db, { password: 123 }, IP, SECRET, CORRECT_PASSWORD);
    expect(result.status).toBe(400);
    expect(result.sessionToken).toBeUndefined();
  });

  it("rejects the wrong password", async () => {
    const result = await handleAdminLogin(testDb.db, { password: "wrong" }, IP, SECRET, CORRECT_PASSWORD);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, reason: "invalid" });
  });

  it("rate-limits after repeated failures from the same IP", async () => {
    for (let i = 0; i < 10; i++) {
      await handleAdminLogin(testDb.db, { password: "wrong" }, IP, SECRET, CORRECT_PASSWORD);
    }
    const result = await handleAdminLogin(testDb.db, { password: CORRECT_PASSWORD }, IP, SECRET, CORRECT_PASSWORD);
    expect(result.status).toBe(429);
    expect(result.body).toEqual({ ok: false, reason: "rate_limited" });
  });
});
