import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { clientIp } from "../../_lib/request";
import { ADMIN_SESSION_COOKIE_NAME, requireAdminPassword } from "../../_lib/admin-session";
import { SESSION_MAX_AGE_SECONDS, requireSessionSecret } from "../../_lib/session";
import { handleAdminLogin } from "./logic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ip = clientIp(request.headers.get("x-forwarded-for"));

  const result = await handleAdminLogin(getDb(), body, ip, requireSessionSecret(), requireAdminPassword());

  const response = NextResponse.json(result.body, { status: result.status });
  if (result.sessionToken) {
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME);
  return response;
}
