import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { isAdminSession } from "../../../../_lib/admin-session";
import { renderAdminReportPdf } from "./logic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/admin/reports/[id]/pdf">) {
  const { id } = await ctx.params;
  const isAdmin = isAdminSession(request.cookies);

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
