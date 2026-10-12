// Sliding idle-timeout refresh for both session types (operator-dashboard
// spec.md D11). Server Components can't set cookies -- only Route
// Handlers and Proxy can -- so this is what makes "idle" (resets on
// any page view, not just API calls) possible at all. The actual
// refresh logic lives in api/_lib/proxy-logic.ts; this file is only
// NextRequest/NextResponse plumbing, same thin-wrapper precedent as
// every route.ts in this project.
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "./app/api/_lib/admin-session";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, requireSessionSecret } from "./app/api/_lib/session";
import { refreshSessionCookies } from "./app/api/_lib/proxy-logic";

export function proxy(request: NextRequest) {
  const secret = requireSessionSecret();
  // DELETE here always means "log out" (the only DELETE handlers in this
  // app are the two logout routes). Refreshing the cookie here would race
  // the route's own delete with no guaranteed ordering between the two
  // Set-Cookie headers -- confirmed live: without this check, a real
  // logout request came back with both a fresh, still-valid cookie from
  // here and an expired one from the route, in the same response (D12).
  const isLogoutRequest = request.method === "DELETE";
  const refreshed = isLogoutRequest
    ? {}
    : refreshSessionCookies(
        {
          session: request.cookies.get(SESSION_COOKIE_NAME)?.value,
          admin: request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value,
        },
        secret,
      );

  const response = NextResponse.next();
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
  if (refreshed.session) {
    response.cookies.set(SESSION_COOKIE_NAME, refreshed.session, cookieOptions);
  }
  if (refreshed.admin) {
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, refreshed.admin, cookieOptions);
  }
  return response;
}

export const config = {
  // Excludes exactly /api/reports and /api/admin/reports (not their
  // sub-paths, like /api/reports/[id]) -- the first fix (skipping just
  // the Set-Cookie call on those two paths, still letting Proxy run and
  // return NextResponse.next()) did NOT resolve a real production 500,
  // confirmed with a second live attempt after that fix deployed. This
  // is the stronger test: Proxy's function body never runs at all for
  // these two routes, ruling out any interaction with their long-lived
  // SSE streaming response, not just the cookie-setting part of it.
  matcher: ["/cma/:path*", "/admin/:path*", "/api/((?!reports$|admin/reports$).*)"],
};
