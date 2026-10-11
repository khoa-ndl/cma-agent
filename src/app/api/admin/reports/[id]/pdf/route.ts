import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "../../../../_lib/admin-session";
import { requireSessionSecret } from "../../../../_lib/session";
import { renderAdminReportPdf } from "./logic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/admin/reports/[id]/pdf">) {
  const { id } = await ctx.params;
  const isAdmin = resolveAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());

  const result = await renderAdminReportPdf(getDb(), id, isAdmin);
  if (result.kind === "error") {
    return NextResponse.json(result.body, { status: result.status });
  }

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cma-${id}.pdf"`,
    },
  });
}
