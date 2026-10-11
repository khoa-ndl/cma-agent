// Pure logic for proxy.ts's sliding idle-timeout refresh (operator-
// dashboard spec.md D11). Kept separate from proxy.ts itself for the
// same reason every other route has a logic.ts/route.ts split in this
// project: proxy.ts's job is just NextRequest/NextResponse plumbing
// and reading SESSION_SECRET from the environment, neither of which
// this function needs to know about.
import { createSessionToken, verifySessionToken } from "@/lib/credits/session";
import { createAdminSessionToken, verifyAdminSessionToken } from "@/lib/admin/session";

export interface ProxyCookies {
  session?: string;
  admin?: string;
}

/** A still-valid cookie is reissued with a fresh issuedAt, sliding its
 * idle window forward. A missing, invalid, or already-expired cookie
 * is left out of the result entirely -- proxy.ts must not set
 * anything for it, so the normal page-level redirect-to-login logic
 * still applies untouched. */
export function refreshSessionCookies(cookies: ProxyCookies, secret: string): ProxyCookies {
  const refreshed: ProxyCookies = {};

  if (cookies.session) {
    const payload = verifySessionToken(cookies.session, secret);
    if (payload) refreshed.session = createSessionToken(payload.accessCodeId, secret);
  }

  if (cookies.admin) {
    const payload = verifyAdminSessionToken(cookies.admin, secret);
    if (payload) refreshed.admin = createAdminSessionToken(secret);
  }

  return refreshed;
}
