import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { clientIp } from "../_lib/request";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, requireSessionSecret } from "../_lib/session";
import { handleAccessRequest } from "./logic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ip = clientIp(request.headers.get("x-forwarded-for"));

  const result = await handleAccessRequest(getDb(), body, ip, requireSessionSecret());

  const response = NextResponse.json(result.body, { status: result.status });
  if (result.sessionToken) {
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
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
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
