// Route-layer wrapper around lib/admin/session.ts, mirroring _lib/session.ts's
// split: this file knows about cookies and env vars, lib/admin/session.ts
// stays framework-agnostic.
import { verifyAdminSessionToken } from "@/lib/admin/session";
import { requireSessionSecret } from "./session";

export const ADMIN_SESSION_COOKIE_NAME = "cma_admin_session";

export function resolveAdminSession(cookieValue: string | undefined, secret: string): boolean {
  if (!cookieValue) return false;
  return verifyAdminSessionToken(cookieValue, secret) !== null;
}

// A cookies() store and a NextRequest's .cookies both match this shape.
interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/** Found in review: every admin page and route re-derived `isAdmin` with
 * the same three-line cookie-read + secret + verify call, with nothing
 * varying per call site. One shared composition over the two already-
 * tested primitives above. */
export function isAdminSession(cookies: CookieReader): boolean {
  return resolveAdminSession(cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());
}

/** Every /api/admin/* route needs this; thrown early and loudly rather
 * than comparing against `undefined` if the environment is misconfigured. */
export function requireAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is not set. Copy .env.example to .env and fill in a value.");
  }
  return password;
}
