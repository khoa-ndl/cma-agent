import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../../../_lib/session";
import { renderReportPdf } from "./logic";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/reports/[id]/pdf">) {
  const { id } = await ctx.params;
  const accessCodeId = resolveAccessCodeId(request.cookies.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());

  const result = await renderReportPdf(getDb(), id, accessCodeId);
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
