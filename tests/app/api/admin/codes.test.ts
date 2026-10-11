import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../../../helpers/db";
import { accessCodes } from "@/lib/db/schema";
import { checkAccessCode, generateAccessCode, hashAccessCode, OPERATOR_CODE_LABEL } from "@/lib/credits/access";
import { handleIssueCode, listAdminCodes } from "@/app/api/admin/codes/logic";
import { handleRevokeCode } from "@/app/api/admin/codes/[id]/revoke/logic";

describe("listAdminCodes", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const result = await listAdminCodes(testDb.db, false);
    expect(result).toEqual({ status: 401, body: { reason: "unauthenticated" } });
  });

  it("lists issued codes, excluding the operator sentinel (D5)", async () => {
    await testDb.db.insert(accessCodes).values([
      { codeHash: hashAccessCode("a"), label: "Jane", creditsBalance: 45 },
      { codeHash: hashAccessCode("sentinel"), label: OPERATOR_CODE_LABEL, creditsBalance: 0 },
    ]);

    const result = await listAdminCodes(testDb.db, true);
    expect(result.status).toBe(200);
    const body = result.body as { codes: Array<{ label: string }> };
    expect(body.codes.map((c) => c.label)).toEqual(["Jane"]);
  });
});

describe("handleIssueCode", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const result = await handleIssueCode(testDb.db, { label: "Jane", credits: 45 }, false);
    expect(result).toEqual({ status: 401, body: { reason: "unauthenticated" } });
  });

  it("rejects a malformed request body", async () => {
    const result = await handleIssueCode(testDb.db, { label: "", credits: 45 }, true);
    expect(result.status).toBe(400);
  });

  it("issues a code that works, the same way the CLI script does (D3)", async () => {
    const result = await handleIssueCode(testDb.db, { label: "Jane", credits: 45 }, true);
    expect(result.status).toBe(200);
    const body = result.body as { code: string };
    expect(body.code).toBeTruthy();

    const loginResult = await checkAccessCode(testDb.db, body.code, "198.51.100.1");
    expect(loginResult.ok).toBe(true);
    expect(loginResult.creditsBalance).toBe(45);
  });

  // Found in review: nothing stopped an admin from issuing a real,
  // metered code labeled exactly "__operator__" -- which would then
  // silently vanish from every customer-facing list (they all exclude
  // that one label) and have its real reports mislabeled "Operator"
  // in cost tracking, breaking the "appears in exactly two places"
  // invariant plan.md's own risk table assumes.
  it("rejects the reserved sentinel label", async () => {
    const result = await handleIssueCode(testDb.db, { label: OPERATOR_CODE_LABEL, credits: 45 }, true);
    expect(result.status).toBe(400);
  });
});

describe("handleRevokeCode", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const result = await handleRevokeCode(testDb.db, "00000000-0000-0000-0000-000000000000", false);
    expect(result).toEqual({ status: 401, body: { reason: "unauthenticated" } });
  });

  it("blocks the code from a new login (D4)", async () => {
    const code = generateAccessCode();
    const [row] = await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode(code), label: "Jane", creditsBalance: 45 })
      .returning();

    const result = await handleRevokeCode(testDb.db, row.id, true);
    expect(result.status).toBe(200);

    const loginResult = await checkAccessCode(testDb.db, code, "198.51.100.2");
    expect(loginResult).toEqual({ ok: false, reason: "revoked" });
  });
});
