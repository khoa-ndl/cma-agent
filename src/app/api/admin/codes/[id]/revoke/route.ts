import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "../../../../_lib/admin-session";
import { requireSessionSecret } from "../../../../_lib/session";
import { handleRevokeCode } from "./logic";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/codes/[id]/revoke">) {
  const { id } = await ctx.params;
  const isAdmin = resolveAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());

  const result = await handleRevokeCode(getDb(), id, isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}
