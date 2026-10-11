import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { isAdminSession } from "../../../../_lib/admin-session";
import { handleRevokeCode } from "./logic";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/codes/[id]/revoke">) {
  const { id } = await ctx.params;
  const isAdmin = isAdminSession(request.cookies);

  const result = await handleRevokeCode(getDb(), id, isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}
