import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { isAdminSession } from "../../../_lib/admin-session";
import { getAdminReport } from "./logic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const { id } = await ctx.params;
  const isAdmin = isAdminSession(request.cookies);

  const result = await getAdminReport(getDb(), id, isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}
