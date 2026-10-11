// POST /api/reports (spec 4.3, 6, A5, A8, A14): validates subject facts,
// reserves credits, then streams the agent run as it happens. On
// completion the report row is updated either way — succeeded with its
// result and usage, or failed with credits refunded (spec 6) — so A14's
// "token usage and cost are recorded for every report" holds for a run
// that fails as much as one that succeeds.
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import type { DataProvider } from "@/lib/data/provider";
import { reports } from "@/lib/db/schema";
import { reserveCredits, refundCredits, type ReserveFailureReason } from "@/lib/credits/credits";
import { subjectInputSchema, type Subject } from "@/lib/engine/adjustments";
import { runCmaAgent, type AgentProgressEvent, type AgentRunOutcome } from "@/lib/agent/loop";
import type { ModelTurn } from "@/lib/agent/model-client";

// Display-only — the engine never sees this, only Subject's own facts
// (lat/long/area/etc.) drive the analysis. Optional so older clients (or
// a submission with no address text for some reason) still work.
const addressSchema = z.object({ unparsedAddress: z.string().min(1).max(200).optional() });

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
  const addressResult = addressSchema.safeParse(body);
  const unparsedAddress = addressResult.success ? addressResult.data.unparsedAddress : undefined;

  const stored = unparsedAddress ? { ...subject, unparsedAddress } : subject;
  const reserve = await reserveCredits(db, accessCodeId, stored as unknown as Record<string, unknown>);
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

const MAX_LISTED_REPORTS = 100;

export interface ReportListItem {
  id: string;
  status: "running" | "succeeded" | "failed";
  unparsedAddress: string | null;
  mlsAreaMajor: string | null;
  costUsd: string | null;
  createdAt: Date;
}

export interface ReportListResult {
  status: number;
  body: unknown;
}

// GET /api/reports (spec 5's "Reports Generated" list): the caller's own
// reports, newest first. unparsedAddress is display-only metadata stored
// alongside Subject in the same jsonb column (not part of Subject itself,
// since the engine never needs it) — null for reports created before this
// existed, where mlsAreaMajor is the fallback label.
export async function listReports<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  accessCodeId: string | null,
): Promise<ReportListResult> {
  if (!accessCodeId) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  const rows = await db
    .select()
    .from(reports)
    .where(eq(reports.accessCodeId, accessCodeId))
    .orderBy(desc(reports.createdAt))
    .limit(MAX_LISTED_REPORTS);

  const items: ReportListItem[] = rows.map((row) => {
    const subject = row.subject as { unparsedAddress?: string; mlsAreaMajor?: string } | null;
    return {
      id: row.id,
      status: row.status,
      unparsedAddress: subject?.unparsedAddress ?? null,
      mlsAreaMajor: subject?.mlsAreaMajor ?? null,
      costUsd: row.costUsd,
      createdAt: row.createdAt,
    };
  });

  return { status: 200, body: { reports: items } };
}
