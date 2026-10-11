import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { runModelTurn } from "@/lib/agent/model-client";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "../../_lib/admin-session";
import { requireSessionSecret } from "../../_lib/session";
import { handleCreateOperatorReport, listAllReports, type AdminReportStreamEvent } from "./logic";

export async function GET(request: NextRequest) {
  const isAdmin = resolveAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  const result = await listAllReports(getDb(), isAdmin);
  return NextResponse.json(result.body, { status: result.status });
}

function toSseStream(events: AsyncGenerator<AdminReportStreamEvent, void>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await events.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
    },
    async cancel() {
      await events.return(undefined);
    },
  });
}

export async function POST(request: NextRequest) {
  const isAdmin = resolveAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());
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
