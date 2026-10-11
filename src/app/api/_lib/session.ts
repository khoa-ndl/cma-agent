// Route-layer wrapper around lib/credits/session.ts: turns a raw cookie
// value into the accessCodeId a route can trust, or null for anything
// invalid. Kept out of session.ts itself so that module stays framework-
// agnostic (no cookie-shape assumptions).
import { MAX_AGE_MS, verifySessionToken } from "@/lib/credits/session";

export const SESSION_COOKIE_NAME = "cma_session";
export const SESSION_MAX_AGE_SECONDS = MAX_AGE_MS / 1000; // derived, not a separate literal

export function resolveAccessCodeId(cookieValue: string | undefined, secret: string): string | null {
  if (!cookieValue) return null;
  return verifySessionToken(cookieValue, secret)?.accessCodeId ?? null;
}

/** Every protected route needs this; thrown early and loudly rather than
 * signing tokens with `undefined` if the environment is misconfigured. */
export function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Copy .env.example to .env and fill in a value.");
  }
  return secret;
}
