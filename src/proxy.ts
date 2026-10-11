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
  const refreshed = refreshSessionCookies(
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
  matcher: ["/cma/:path*", "/admin/:path*", "/api/:path*"],
};
