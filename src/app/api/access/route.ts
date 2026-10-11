import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { clientIp } from "../_lib/request";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../_lib/session";
import { handleAccessRequest } from "./logic";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Copy .env.example to .env and fill in a value.");
  }
  return secret;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ip = clientIp(request.headers.get("x-forwarded-for"));

  const result = await handleAccessRequest(getDb(), body, ip, getSessionSecret());

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
