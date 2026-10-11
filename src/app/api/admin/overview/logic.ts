// GET /api/admin/overview (operator-dashboard spec.md §4 screen 2):
// health, reports stuck running past the stale threshold, this month's
// total spend (including the operator sentinel -- D7), and codes
// running low on balance.
import { and, eq, gte, lt } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { accessCodes, reports } from "@/lib/db/schema";
import { checkHealth } from "@/app/api/health/logic";
import { OPERATOR_CODE_LABEL, listCustomerAccessCodes, type CustomerAccessCode } from "@/lib/credits/access";
import { REPORT_COST, STALE_RUN_MINUTES } from "@/lib/credits/credits";

export interface StuckReport {
  id: string;
  codeLabel: string;
  ageMinutes: number;
}

export interface AdminOverview {
  health: "ok" | "unavailable";
  stuckReports: StuckReport[];
  monthlySpendUsd: number;
  lowBalanceCodes: CustomerAccessCode[];
}

export interface AdminOverviewResult {
  status: number;
  body: unknown;
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getAdminOverview<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  isAdmin: boolean,
): Promise<AdminOverviewResult> {
  if (!isAdmin) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  const health = await checkHealth(db);

  const staleCutoff = new Date(Date.now() - STALE_RUN_MINUTES * 60 * 1000);
  const stuckRows = await db
    .select({ id: reports.id, createdAt: reports.createdAt, codeLabel: accessCodes.label })
    .from(reports)
    .innerJoin(accessCodes, eq(reports.accessCodeId, accessCodes.id))
    .where(and(eq(reports.status, "running"), lt(reports.createdAt, staleCutoff)));

  const stuckReports: StuckReport[] = stuckRows.map((row) => ({
    id: row.id,
    codeLabel: row.codeLabel === OPERATOR_CODE_LABEL ? "Operator" : row.codeLabel,
    ageMinutes: Math.floor((Date.now() - row.createdAt.getTime()) / 60_000),
  }));

  const spendRows = await db
    .select({ costUsd: reports.costUsd })
    .from(reports)
    .where(gte(reports.createdAt, startOfCurrentMonthUtc()));
  const monthlySpendUsd = spendRows.reduce((sum, row) => sum + Number(row.costUsd ?? 0), 0);

  const customerCodes = await listCustomerAccessCodes(db);
  const lowBalanceCodes = customerCodes.filter((code) => code.creditsBalance < REPORT_COST);

  const body: AdminOverview = { health: health.body.status, stuckReports, monthlySpendUsd, lowBalanceCodes };
  return { status: 200, body };
}
