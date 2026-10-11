import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/credits/session";
import { createAdminSessionToken, verifyAdminSessionToken } from "@/lib/admin/session";
import { refreshSessionCookies } from "@/app/api/_lib/proxy-logic";

const SECRET = "test-secret";

describe("refreshSessionCookies", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reissues a valid end-user session cookie, leaving its accessCodeId intact", () => {
    const token = createSessionToken("code-123", SECRET);
    const result = refreshSessionCookies({ session: token }, SECRET);
    expect(result.session).toBeDefined();
    expect(verifySessionToken(result.session!, SECRET)).toEqual({ accessCodeId: "code-123" });
  });

  it("reissues a valid admin session cookie", () => {
    const token = createAdminSessionToken(SECRET);
    const result = refreshSessionCookies({ admin: token }, SECRET);
    expect(result.admin).toBeDefined();
    expect(verifyAdminSessionToken(result.admin!, SECRET)).toEqual({ kind: "admin" });
  });

  it("leaves out a missing cookie", () => {
    const result = refreshSessionCookies({}, SECRET);
    expect(result.session).toBeUndefined();
    expect(result.admin).toBeUndefined();
  });

  it("leaves out an invalid (wrong-secret) cookie, rather than reissuing it", () => {
    const token = createSessionToken("code-123", "a-different-secret");
    const result = refreshSessionCookies({ session: token }, SECRET);
    expect(result.session).toBeUndefined();
  });

  it("leaves out an already-expired cookie, rather than reviving it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createSessionToken("code-123", SECRET);
    vi.setSystemTime(91 * 60 * 1000); // 91 minutes later: past the 90-min window
    const result = refreshSessionCookies({ session: token }, SECRET);
    expect(result.session).toBeUndefined();
  });

  it("slides the idle window forward: a refreshed token outlives what the original token's own expiry would allow (D11)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const original = createSessionToken("code-123", SECRET);

    vi.setSystemTime(89 * 60 * 1000); // 89 minutes later: still valid, refresh it
    const refreshed = refreshSessionCookies({ session: original }, SECRET).session!;

    vi.setSystemTime(89 * 60 * 1000 + 89 * 60 * 1000); // 89 more minutes
    // The original token would be long expired by now (178 min old)...
    expect(verifySessionToken(original, SECRET)).toBeNull();
    // ...but the refreshed one is only 89 minutes past its own issuedAt.
    expect(verifySessionToken(refreshed, SECRET)).toEqual({ accessCodeId: "code-123" });
  });

  it("refreshes both cookies independently when both are present", () => {
    const sessionToken = createSessionToken("code-123", SECRET);
    const adminToken = createAdminSessionToken(SECRET);
    const result = refreshSessionCookies({ session: sessionToken, admin: adminToken }, SECRET);
    expect(result.session).toBeDefined();
    expect(result.admin).toBeDefined();
  });
});
