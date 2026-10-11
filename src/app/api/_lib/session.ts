// Route-layer wrapper around lib/credits/session.ts: turns a raw cookie
// value into the accessCodeId a route can trust, or null for anything
// invalid. Kept out of session.ts itself so that module stays framework-
// agnostic (no cookie-shape assumptions).
import { verifySessionToken } from "@/lib/credits/session";

export const SESSION_COOKIE_NAME = "cma_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // matches session.ts's expiry

export function resolveAccessCodeId(cookieValue: string | undefined, secret: string): string | null {
  if (!cookieValue) return null;
  return verifySessionToken(cookieValue, secret)?.accessCodeId ?? null;
}
