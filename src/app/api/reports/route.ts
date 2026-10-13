import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { runModelTurn } from "@/lib/agent/model-client";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../_lib/session";
import { toSseStream } from "../_lib/sse-stream";
import { handleCreateReport, listReports } from "./logic";

export async function GET(request: NextRequest) {
  const accessCodeId = resolveAccessCodeId(request.cookies.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  const result = await listReports(getDb(), accessCodeId);
  return NextResponse.json(result.body, { status: result.status });
}

// A typical CMA run (3 tool calls) finishes in single-digit seconds, but
// this bounds the worst case explicitly rather than relying on whatever
// Vercel's unstated default happens to be (plan.md Step 11, spec C3).
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const accessCodeId = resolveAccessCodeId(request.cookies.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  const body = await request.json().catch(() => null);

  const db = getDb();
  const provider = createSampleDataProvider(db);
  const result = await handleCreateReport(db, provider, runModelTurn, body, accessCodeId);

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
