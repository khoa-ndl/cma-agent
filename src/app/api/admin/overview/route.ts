import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "../../_lib/admin-session";
import { requireSessionSecret } from "../../_lib/session";
import { getAdminOverview } from "./logic";

export async function GET(request: NextRequest) {
  const isAdmin = resolveAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  const result = await getAdminOverview(getDb(), isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}
