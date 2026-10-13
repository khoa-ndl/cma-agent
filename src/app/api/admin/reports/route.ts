import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { runModelTurn } from "@/lib/agent/model-client";
import { isAdminSession } from "../../_lib/admin-session";
import { toSseStream } from "../../_lib/sse-stream";
import { handleCreateOperatorReport, listAllReports } from "./logic";

// Same bound as the end-user reports route (src/app/api/reports/route.ts) —
// shares the same agent loop and the same unconfirmed-default risk.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const isAdmin = isAdminSession(request.cookies);
  const result = await listAllReports(getDb(), isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const isAdmin = isAdminSession(request.cookies);
  const body = await request.json().catch(() => null);

  const db = getDb();
  const provider = createSampleDataProvider(db);
  const result = await handleCreateOperatorReport(db, provider, runModelTurn, body, isAdmin);

  if (result.kind === "error") {
    return NextResponse.json(result.body, { status: result.status });
  }

  return new Response(toSseStream(result.events), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      "X-Report-Id": result.reportId,
    },
  });
}
