import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { accessCodes } from "@/lib/db/schema";
import {
  checkAccessCode,
  generateAccessCode,
  getAccessCodeStatus,
  hashAccessCode,
  issueAccessCode,
  listCustomerAccessCodes,
  OPERATOR_CODE_LABEL,
  revokeAccessCode,
} from "@/lib/credits/access";

describe("generateAccessCode / hashAccessCode", () => {
  it("generates unique, dash-grouped codes", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateAccessCode()));
    expect(codes.size).toBe(20);
    for (const code of codes) {
      // 16 bytes base32-encodes to 26 characters, which doesn't divide
      // evenly into groups of 4 — the last group is short (2 chars here).
      expect(code).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{1,4})+$/);
    }
  });

  it("normalizes dashes and case before hashing", () => {
    expect(hashAccessCode("ABCD-EFGH")).toBe(hashAccessCode("abcdefgh"));
  });

  it("hashes different codes differently", () => {
    expect(hashAccessCode(generateAccessCode())).not.toBe(hashAccessCode(generateAccessCode()));
  });
});

describe("checkAccessCode", () => {
  let testDb: TestDb;
  const IP = "203.0.113.1";

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("accepts a valid, active code", async () => {
    const code = generateAccessCode();
    await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode(code), label: "Test", creditsBalance: 45 });

    const result = await checkAccessCode(testDb.db, code, IP);
    expect(result.ok).toBe(true);
    expect(result.creditsBalance).toBe(45);
  });

  it("rejects an unknown code", async () => {
    const result = await checkAccessCode(testDb.db, generateAccessCode(), IP);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a revoked code even with the right value", async () => {
    const code = generateAccessCode();
    await testDb.db.insert(accessCodes).values({
      codeHash: hashAccessCode(code),
      label: "Test",
      creditsBalance: 45,
      revokedAt: new Date(),
    });

    const result = await checkAccessCode(testDb.db, code, IP);
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });

  it("rate-limits an IP after repeated failures, without checking a valid code in the meantime", async () => {
    for (let i = 0; i < 10; i++) {
      await checkAccessCode(testDb.db, "wrong-code", IP);
    }

    const code = generateAccessCode();
    await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode(code), label: "Test", creditsBalance: 45 });

    const result = await checkAccessCode(testDb.db, code, IP);
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("does not rate-limit a different IP", async () => {
    for (let i = 0; i < 10; i++) {
      await checkAccessCode(testDb.db, "wrong-code", IP);
    }

    const code = generateAccessCode();
    await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode(code), label: "Test", creditsBalance: 45 });

    const result = await checkAccessCode(testDb.db, code, "198.51.100.9");
    expect(result.ok).toBe(true);
  });
});

describe("getAccessCodeStatus", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("returns the current balance for an active code", async () => {
    const [row] = await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode("x"), label: "Test", creditsBalance: 30 })
      .returning();

    expect(await getAccessCodeStatus(testDb.db, row.id)).toEqual({ creditsBalance: 30, revoked: false });
  });

  it("reports a revoked code as revoked", async () => {
    const [row] = await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode("x"), label: "Test", creditsBalance: 30, revokedAt: new Date() })
      .returning();

    expect(await getAccessCodeStatus(testDb.db, row.id)).toEqual({ creditsBalance: 30, revoked: true });
  });

  it("returns null for an id that doesn't exist", async () => {
    expect(await getAccessCodeStatus(testDb.db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("issueAccessCode", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("creates a working code, the same way the CLI script does (D3)", async () => {
    const { code } = await issueAccessCode(testDb.db, "Jane", 45);
    const result = await checkAccessCode(testDb.db, code, "198.51.100.1");
    expect(result.ok).toBe(true);
    expect(result.creditsBalance).toBe(45);
  });
});

describe("revokeAccessCode", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("blocks the code from a new report (D4)", async () => {
    const { code, accessCodeId } = await issueAccessCode(testDb.db, "Jane", 45);
    await revokeAccessCode(testDb.db, accessCodeId);

    const result = await checkAccessCode(testDb.db, code, "198.51.100.2");
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });
});

describe("listCustomerAccessCodes", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("lists issued codes", async () => {
    await issueAccessCode(testDb.db, "Jane", 45);
    await issueAccessCode(testDb.db, "John", 20);

    const codes = await listCustomerAccessCodes(testDb.db);
    expect(codes.map((c) => c.label).sort()).toEqual(["Jane", "John"]);
  });

  it("never includes the operator sentinel (D5)", async () => {
    await testDb.db
      .insert(accessCodes)
      .values({ codeHash: hashAccessCode("sentinel"), label: OPERATOR_CODE_LABEL, creditsBalance: 0 });
    await issueAccessCode(testDb.db, "Jane", 45);

    const codes = await listCustomerAccessCodes(testDb.db);
    expect(codes.map((c) => c.label)).toEqual(["Jane"]);
  });
});
