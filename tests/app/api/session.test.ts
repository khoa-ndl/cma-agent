import { describe, expect, it } from "vitest";
import { createSessionToken, MAX_AGE_MS } from "@/lib/credits/session";
import { resolveAccessCodeId, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/app/api/_lib/session";

const SECRET = "test-secret";

describe("resolveAccessCodeId", () => {
  it("returns the accessCodeId for a valid session cookie", () => {
    const token = createSessionToken("code-123", SECRET);
    expect(resolveAccessCodeId(token, SECRET)).toBe("code-123");
  });

  it("returns null when there is no cookie", () => {
    expect(resolveAccessCodeId(undefined, SECRET)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const token = createSessionToken("code-123", "a-different-secret");
    expect(resolveAccessCodeId(token, SECRET)).toBeNull();
  });
});

describe("SESSION_MAX_AGE_SECONDS", () => {
  it("is 90 minutes (the idle timeout)", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(90 * 60);
  });

  it("never drifts from session.ts's own MAX_AGE_MS", () => {
    expect(SESSION_MAX_AGE_SECONDS * 1000).toBe(MAX_AGE_MS);
  });
});

it("SESSION_COOKIE_NAME is a non-empty cookie-safe name", () => {
  expect(SESSION_COOKIE_NAME).toMatch(/^[a-zA-Z0-9_-]+$/);
});
