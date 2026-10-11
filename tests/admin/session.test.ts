import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAdminSessionToken, verifyAdminSessionToken } from "@/lib/admin/session";
import { createSessionToken, verifySessionToken } from "@/lib/credits/session";

const SECRET = "test-secret";

describe("admin session tokens", () => {
  it("verifies a token it created", () => {
    const token = createAdminSessionToken(SECRET);
    expect(verifyAdminSessionToken(token, SECRET)).not.toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createAdminSessionToken(SECRET);
    expect(verifyAdminSessionToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createAdminSessionToken(SECRET);
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ kind: "admin", issuedAt: Date.now() + 1000 })).toString(
      "base64url",
    );
    expect(verifyAdminSessionToken(`${tamperedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createAdminSessionToken(SECRET);
    const [encoded] = token.split(".");
    expect(verifyAdminSessionToken(`${encoded}.not-the-real-signature`, SECRET)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    expect(verifyAdminSessionToken("", SECRET)).toBeNull();
    expect(verifyAdminSessionToken("not-a-token", SECRET)).toBeNull();
    expect(verifyAdminSessionToken("a.b.c", SECRET)).toBeNull();
  });

  it("rejects an expired token, even with a correct signature", () => {
    const payload = { kind: "admin", issuedAt: Date.now() - 91 * 60 * 1000 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    expect(verifyAdminSessionToken(`${encoded}.${signature}`, SECRET)).toBeNull();
  });

  it("accepts a token issued just under 90 minutes ago", () => {
    const payload = { kind: "admin", issuedAt: Date.now() - 89 * 60 * 1000 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    expect(verifyAdminSessionToken(`${encoded}.${signature}`, SECRET)).not.toBeNull();
  });

  it("an admin token never authenticates as an end-user session, and vice versa (D2)", () => {
    const adminToken = createAdminSessionToken(SECRET);
    const userToken = createSessionToken("code-123", SECRET);

    expect(verifySessionToken(adminToken, SECRET)).toBeNull();
    expect(verifyAdminSessionToken(userToken, SECRET)).toBeNull();
  });
});
