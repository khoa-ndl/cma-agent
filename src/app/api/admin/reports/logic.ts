// POST /api/admin/reports (operator-dashboard spec.md §4 screen 5):
// generates a report attached to the operator sentinel, unmetered.
// Mirrors api/reports/logic.ts's handleCreateReport/streamReport shape
// so the SSE event stream and the client UI are identical, but calls
// createOperatorReport instead of reserveCredits and never calls
// refundCredits -- there's nothing to refund.
import { eq, desc } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import type { DataProvider } from "@/lib/data/provider";
import { accessCodes, reports } from "@/lib/db/schema";
import { createOperatorReport, OPERATOR_CODE_LABEL } from "@/lib/credits/operator";
import { subjectInputSchema, type Subject } from "@/lib/engine/adjustments";
import { addressSchema } from "@/app/api/reports/logic";
import { runCmaAgent, type AgentProgressEvent, type AgentRunOutcome } from "@/lib/agent/loop";
import type { ModelTurn } from "@/lib/agent/model-client";

export type AdminReportStreamEvent = AgentProgressEvent | { type: "done"; outcome: AgentRunOutcome };

export type CreateOperatorReportResult =
  | { kind: "error"; status: number; body: unknown }
  | { kind: "stream"; reportId: string; events: AsyncGenerator<AdminReportStreamEvent, void> };

export async function handleCreateOperatorReport<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  provider: DataProvider,
  modelTurn: ModelTurn,
  body: unknown,
  isAdmin: boolean,
): Promise<CreateOperatorReportResult> {
  if (!isAdmin) {
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

  const created = await createOperatorReport(db, stored as unknown as Record<string, unknown>);
  if (!created.ok) {
    return { kind: "error", status: 409, body: { reason: created.reason } };
  }

  return {
    kind: "stream",
    reportId: created.reportId,
    events: streamOperatorReport(db, provider, modelTurn, subject, created.reportId),
  };
}

const UNEXPECTED_ERROR_OUTCOME: AgentRunOutcome = {
  status: "failed",
  failureReason: "unexpected_error",
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
  costUsd: 0,
};

async function* streamOperatorReport<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  provider: DataProvider,
  modelTurn: ModelTurn,
  subject: Subject,
  reportId: string,
): AsyncGenerator<AdminReportStreamEvent, void> {
  // Found live in production: an error that isn't one of the agent
  // loop's own handled failure modes used to propagate straight out of
  // this generator, skipping the DB update below entirely -- the
  // report stayed "running" forever (confirmed in the real Reports &
  // costs screen) and blocked every later operator report with
  // "already_running" until the 5-minute stale sweep caught it. This
  // still marks it failed and logs the real error so it's never
  // invisible again.
  try {
    const generator = runCmaAgent(subject, provider, modelTurn);
    let next = await generator.next();
    while (!next.done) {
      yield next.value;
      next = await generator.next();
    }
    const outcome = next.value;

    // No refundCredits call on failure here -- an operator report never
    // reserved credits in the first place, so there's nothing to refund.
    // Mirrors api/reports/logic.ts's streamReport: a succeeded run stores
    // its result, a failed one doesn't, both still record usage and
    // finishedAt (unlike the end-user path, which only refunds here and
    // lets refundCredits itself set status/finishedAt).
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
      await db
        .update(reports)
        .set({
          status: "failed",
          inputTokens: outcome.usage.inputTokens,
          outputTokens: outcome.usage.outputTokens,
          cacheReadTokens: outcome.usage.cacheReadTokens,
          costUsd: outcome.costUsd.toFixed(4),
          finishedAt: new Date(),
        })
        .where(eq(reports.id, reportId));
    }

    yield { type: "done", outcome };
  } catch (err) {
    console.error(`Operator report ${reportId} crashed unexpectedly:`, err);
    await db
      .update(reports)
      .set({ status: "failed", finishedAt: new Date() })
      .where(eq(reports.id, reportId));
    yield { type: "done", outcome: UNEXPECTED_ERROR_OUTCOME };
  }
}

const MAX_LISTED_ADMIN_REPORTS = 200;

export interface AdminReportListItem {
  id: string;
  status: "running" | "succeeded" | "failed";
  codeLabel: string;
  unparsedAddress: string | null;
  mlsAreaMajor: string | null;
  costUsd: string | null;
  createdAt: Date;
}

export interface AdminReportListResult {
  status: number;
  body: unknown;
}

// GET /api/admin/reports (operator-dashboard spec.md §4 screen 4): every
// report across every code, unlike the end-user listReports which scopes
// to one accessCodeId. The sentinel's own reports are included, labeled
// "Operator" rather than its internal "__operator__" label.
export async function listAllReports<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  isAdmin: boolean,
): Promise<AdminReportListResult> {
  if (!isAdmin) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  const rows = await db
    .select({
      id: reports.id,
      status: reports.status,
      subject: reports.subject,
      costUsd: reports.costUsd,
      createdAt: reports.createdAt,
      codeLabel: accessCodes.label,
    })
    .from(reports)
    .innerJoin(accessCodes, eq(reports.accessCodeId, accessCodes.id))
    .orderBy(desc(reports.createdAt))
    .limit(MAX_LISTED_ADMIN_REPORTS);

  const items: AdminReportListItem[] = rows.map((row) => {
    const subject = row.subject as { unparsedAddress?: string; mlsAreaMajor?: string } | null;
    return {
      id: row.id,
      status: row.status,
      codeLabel: row.codeLabel === OPERATOR_CODE_LABEL ? "Operator" : row.codeLabel,
      unparsedAddress: subject?.unparsedAddress ?? null,
      mlsAreaMajor: subject?.mlsAreaMajor ?? null,
      costUsd: row.costUsd,
      createdAt: row.createdAt,
    };
  });

  return { status: 200, body: { reports: items } };
}
