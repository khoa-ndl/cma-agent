import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/credits/session";

const SECRET = "test-secret";

describe("session tokens", () => {
  it("verifies a token it created", () => {
    const token = createSessionToken("code-123", SECRET);
    expect(verifySessionToken(token, SECRET)).toEqual({ accessCodeId: "code-123" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken("code-123", SECRET);
    expect(verifySessionToken(token, "wrong-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createSessionToken("code-123", SECRET);
    const [, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ accessCodeId: "someone-elses-code", issuedAt: Date.now() }),
    ).toString("base64url");
    expect(verifySessionToken(`${tamperedPayload}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createSessionToken("code-123", SECRET);
    const [encoded] = token.split(".");
    expect(verifySessionToken(`${encoded}.not-the-real-signature`, SECRET)).toBeNull();
  });

  it("rejects malformed input without throwing", () => {
    expect(verifySessionToken("", SECRET)).toBeNull();
    expect(verifySessionToken("not-a-token", SECRET)).toBeNull();
    expect(verifySessionToken("a.b.c", SECRET)).toBeNull();
  });

  it("rejects an expired token, even with a correct signature", () => {
    // Built by hand, signed the same way session.ts signs a real token,
    // so this isolates the expiry check from the signature check.
    const payload = { accessCodeId: "code-123", issuedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", SECRET).update(encoded).digest("base64url");

    expect(verifySessionToken(`${encoded}.${signature}`, SECRET)).toBeNull();
  });
});
