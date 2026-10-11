import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { runModelTurn } from "@/lib/agent/model-client";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../_lib/session";
import { handleCreateReport, type ReportStreamEvent } from "./logic";

// Vercel's function duration limit (plan.md Step 11, spec C3) isn't
// confirmed yet, so `maxDuration` isn't set here — that's Step 11's job,
// once the real limit is known.

function toSseStream(events: AsyncGenerator<ReportStreamEvent, void>): ReadableStream<Uint8Array> {
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
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
