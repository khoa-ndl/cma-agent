import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../../_lib/session";
import { getReport } from "./logic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[id]">) {
  const { id } = await ctx.params;
  const accessCodeId = resolveAccessCodeId(request.cookies.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());

  const result = await getReport(getDb(), id, accessCodeId);
  return NextResponse.json(result.body, { status: result.status });
}
