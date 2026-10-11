import { describe, expect, it } from "vitest";
import { createAdminSessionToken } from "@/lib/admin/session";
import { createSessionToken } from "@/lib/credits/session";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "@/app/api/_lib/admin-session";

const SECRET = "test-secret";

describe("resolveAdminSession", () => {
  it("returns true for a valid admin session cookie", () => {
    const token = createAdminSessionToken(SECRET);
    expect(resolveAdminSession(token, SECRET)).toBe(true);
  });

  it("returns false when there is no cookie", () => {
    expect(resolveAdminSession(undefined, SECRET)).toBe(false);
  });

  it("returns false for a token signed with a different secret", () => {
    const token = createAdminSessionToken("a-different-secret");
    expect(resolveAdminSession(token, SECRET)).toBe(false);
  });

  it("returns false for an end-user session cookie (D2)", () => {
    const token = createSessionToken("code-123", SECRET);
    expect(resolveAdminSession(token, SECRET)).toBe(false);
  });
});

it("ADMIN_SESSION_COOKIE_NAME is a non-empty cookie-safe name, distinct from the end-user cookie", () => {
  expect(ADMIN_SESSION_COOKIE_NAME).toMatch(/^[a-zA-Z0-9_-]+$/);
  expect(ADMIN_SESSION_COOKIE_NAME).not.toBe("cma_session");
});
