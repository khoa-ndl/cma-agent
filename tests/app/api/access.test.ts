import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../helpers/db";
import { accessCodes } from "@/lib/db/schema";
import { hashAccessCode } from "@/lib/credits/access";
import { verifySessionToken } from "@/lib/credits/session";
import { handleAccessRequest } from "@/app/api/access/logic";

const SECRET = "test-secret";
const IP = "203.0.113.5";

describe("handleAccessRequest", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(accessCodes).values([
      { id: "11111111-1111-1111-1111-111111111111", codeHash: hashAccessCode("GOOD-CODE"), label: "ok", creditsBalance: 45 },
      {
        id: "22222222-2222-2222-2222-222222222222",
        codeHash: hashAccessCode("REVOKED-CODE"),
        label: "revoked",
        creditsBalance: 45,
        revokedAt: new Date(),
      },
    ]);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("sets a valid session token for a valid code", async () => {
    const result = await handleAccessRequest(testDb.db, { code: "GOOD-CODE" }, IP, SECRET);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
    expect(result.sessionToken).toBeDefined();
    expect(verifySessionToken(result.sessionToken!, SECRET)?.accessCodeId).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("rejects a malformed request body", async () => {
    const result = await handleAccessRequest(testDb.db, { code: 123 }, IP, SECRET);
    expect(result.status).toBe(400);
    expect(result.sessionToken).toBeUndefined();
  });

  it("rejects an unknown code", async () => {
    const result = await handleAccessRequest(testDb.db, { code: "NO-SUCH-CODE" }, IP, SECRET);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a revoked code", async () => {
    const result = await handleAccessRequest(testDb.db, { code: "REVOKED-CODE" }, IP, SECRET);
    expect(result.status).toBe(401);
    expect(result.body).toEqual({ ok: false, reason: "revoked" });
  });

  it("rate-limits after repeated failures from the same IP", async () => {
    for (let i = 0; i < 10; i++) {
      await handleAccessRequest(testDb.db, { code: "WRONG" }, IP, SECRET);
    }
    const result = await handleAccessRequest(testDb.db, { code: "WRONG" }, IP, SECRET);
    expect(result.status).toBe(429);
    expect(result.body).toEqual({ ok: false, reason: "rate_limited" });
  });
});
