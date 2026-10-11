// POST /api/reports (spec 4.3, 6, A5, A8, A14): validates subject facts,
// reserves credits, then streams the agent run as it happens. On
// completion the report row is updated either way — succeeded with its
// result and usage, or failed with credits refunded (spec 6) — so A14's
// "token usage and cost are recorded for every report" holds for a run
// that fails as much as one that succeeds.
import { eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import type { DataProvider } from "@/lib/data/provider";
import { reports } from "@/lib/db/schema";
import { reserveCredits, refundCredits, type ReserveFailureReason } from "@/lib/credits/credits";
import { subjectInputSchema, type Subject } from "@/lib/engine/adjustments";
import { runCmaAgent, type AgentProgressEvent, type AgentRunOutcome } from "@/lib/agent/loop";
import type { ModelTurn } from "@/lib/agent/model-client";

export type ReportStreamEvent = AgentProgressEvent | { type: "done"; outcome: AgentRunOutcome };

export type CreateReportResult =
  | { kind: "error"; status: number; body: unknown }
  | { kind: "stream"; reportId: string; events: AsyncGenerator<ReportStreamEvent, void> };

const RESERVE_FAILURE_STATUS: Record<ReserveFailureReason, number> = {
  revoked_or_not_found: 401,
  already_running: 409,
  insufficient_credits: 402,
};

export async function handleCreateReport<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  provider: DataProvider,
  modelTurn: ModelTurn,
  body: unknown,
  accessCodeId: string | null,
): Promise<CreateReportResult> {
  if (!accessCodeId) {
    return { kind: "error", status: 401, body: { reason: "unauthenticated" } };
  }

  const parsed = subjectInputSchema.safeParse(body);
  if (!parsed.success) {
    return { kind: "error", status: 400, body: { reason: "invalid_subject" } };
  }
  const subject: Subject = parsed.data;

  const reserve = await reserveCredits(db, accessCodeId, subject as unknown as Record<string, unknown>);
  if (!reserve.ok) {
    return { kind: "error", status: RESERVE_FAILURE_STATUS[reserve.reason], body: { reason: reserve.reason } };
  }

  return {
    kind: "stream",
    reportId: reserve.reportId,
    events: streamReport(db, provider, modelTurn, subject, reserve.reportId),
  };
}

async function* streamReport<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  provider: DataProvider,
  modelTurn: ModelTurn,
  subject: Subject,
  reportId: string,
): AsyncGenerator<ReportStreamEvent, void> {
  const generator = runCmaAgent(subject, provider, modelTurn);
  let next = await generator.next();
  while (!next.done) {
    yield next.value;
    next = await generator.next();
  }
  const outcome = next.value;

  if (outcome.status === "succeeded") {
    await db
      .update(reports)
      .set({
        status: "succeeded",
        result: outcome.result,
        inputTokens: outcome.usage.inputTokens,
        outputTokens: outcome.usage.outputTokens,
        cacheReadTokens: outcome.usage.cacheReadTokens,
        costUsd: outcome.costUsd.toFixed(4),
        finishedAt: new Date(),
      })
      .where(eq(reports.id, reportId));
  } else {
    await refundCredits(db, reportId);
    await db
      .update(reports)
      .set({
        inputTokens: outcome.usage.inputTokens,
        outputTokens: outcome.usage.outputTokens,
        cacheReadTokens: outcome.usage.cacheReadTokens,
        costUsd: outcome.costUsd.toFixed(4),
      })
      .where(eq(reports.id, reportId));
  }

  yield { type: "done", outcome };
}
