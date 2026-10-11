// Credit reservation, refunds and the stale-run sweep (spec 6, plan.md
// Step 6, departures). Every balance-changing operation is one atomic
// multi-table SQL statement (chained WITH clauses), not a client-side
// transaction — this works identically on Neon's HTTP driver, PGlite, or
// any other Postgres (spec 7, portability rule 2).
import { sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { OPERATOR_CODE_LABEL } from "@/lib/credits/access";

// .execute()'s return shape is tied to the specific driver's query-result
// type (unlike .select()/.insert()), so every function here that calls it
// must be generic over that type too, or TypeScript can't resolve the
// rows it gets back — the same portability pattern client.ts follows.

export const REPORT_COST = 5;
// Generous beyond a typical serverless function's duration; confirm
// against the real limit in Step 11 (plan.md risk: Vercel Hobby duration)
// and tighten if needed. Exported so the admin overview's stuck-reports
// query (operator-dashboard spec.md) shares this threshold.
export const STALE_RUN_MINUTES = 5;

export type ReserveFailureReason = "revoked_or_not_found" | "already_running" | "insufficient_credits";

/**
 * Every Postgres driver's query result includes `.rows` (confirmed for
 * the Neon HTTP driver and PGlite, the two this project uses) — not
 * something the abstract PgQueryResultHKT base type captures statically,
 * since TQueryResult only guarantees the `$brand` field. This one narrow
 * cast stands in for the whole module, instead of asserting it at every
 * call site.
 */
function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

export type ReserveResult =
  | { ok: true; reportId: string; remainingBalance: number }
  | { ok: false; reason: ReserveFailureReason };

/**
 * Reserves REPORT_COST credits and creates the report in one atomic
 * statement: the balance is decremented only if the code exists, isn't
 * revoked, has enough credits, and has no other report already running
 * — the same guarantee the database's own partial unique index backs up
 * independently (spec 3.3). Sweeps stale runs first, so a crashed report
 * can't block a new one forever.
 */
export async function reserveCredits<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  accessCodeId: string,
  subject: Record<string, unknown>,
): Promise<ReserveResult> {
  await sweepStaleRuns(db);

  const result = rowsOf<{ report_id: string; remaining_balance: number }>(await db.execute(sql`
    WITH deducted AS (
      UPDATE access_codes
      SET credits_balance = credits_balance - ${REPORT_COST}
      WHERE id = ${accessCodeId}
        AND revoked_at IS NULL
        AND credits_balance >= ${REPORT_COST}
        AND NOT EXISTS (
          SELECT 1 FROM reports WHERE access_code_id = ${accessCodeId} AND status = 'running'
        )
      RETURNING id, credits_balance
    ),
    new_report AS (
      INSERT INTO reports (access_code_id, status, subject)
      SELECT id, 'running', ${JSON.stringify(subject)}::jsonb FROM deducted
      RETURNING id, access_code_id
    ),
    ledger_entry AS (
      INSERT INTO credit_ledger (access_code_id, delta, reason, report_id)
      SELECT access_code_id, ${-REPORT_COST}, 'report', id FROM new_report
      RETURNING id
    )
    SELECT new_report.id AS report_id, deducted.credits_balance AS remaining_balance
    FROM new_report, deducted
  `));

  if (result.length > 0) {
    const row = result[0];
    return { ok: true, reportId: row.report_id, remainingBalance: row.remaining_balance };
  }

  return diagnoseReservationFailure(db, accessCodeId);
}

async function diagnoseReservationFailure<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  accessCodeId: string,
): Promise<ReserveResult> {
  const result = rowsOf<{ revoked_or_missing: boolean; already_running: boolean }>(
    await db.execute(sql`
      SELECT
        NOT EXISTS (
          SELECT 1 FROM access_codes WHERE id = ${accessCodeId} AND revoked_at IS NULL
        ) AS revoked_or_missing,
        EXISTS (
          SELECT 1 FROM reports WHERE access_code_id = ${accessCodeId} AND status = 'running'
        ) AS already_running
    `),
  );
  const row = result[0];

  if (row.revoked_or_missing) return { ok: false, reason: "revoked_or_not_found" };
  if (row.already_running) return { ok: false, reason: "already_running" };
  return { ok: false, reason: "insufficient_credits" };
}

/** Refunds a running report's reserved credits and marks it failed, in
 * one atomic statement. A no-op if the report isn't running anymore —
 * safe to call more than once. */
export async function refundCredits<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  reportId: string,
): Promise<void> {
  await db.execute(sql`
    WITH failed_report AS (
      UPDATE reports
      SET status = 'failed', finished_at = now()
      WHERE id = ${reportId} AND status = 'running'
      RETURNING access_code_id
    ),
    refunded AS (
      UPDATE access_codes
      SET credits_balance = credits_balance + ${REPORT_COST}
      WHERE id = (SELECT access_code_id FROM failed_report)
      RETURNING id
    )
    INSERT INTO credit_ledger (access_code_id, delta, reason, report_id)
    SELECT access_code_id, ${REPORT_COST}, 'refund', ${reportId} FROM failed_report
  `);
}

/** Fails and refunds any report that's been "running" longer than a
 * crashed serverless function ever could — called before every new
 * reservation (plan.md Step 6 departure), not on a schedule. Every
 * stale report is marked failed, customer or operator alike, so
 * neither kind can block a new one forever -- but the operator
 * sentinel is excluded from the refund and the ledger entry, since it
 * never went through reserveCredits in the first place and has
 * nothing to refund (operator-dashboard spec.md D6). */
export async function sweepStaleRuns<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
): Promise<void> {
  await db.execute(sql`
    WITH stale AS (
      UPDATE reports
      SET status = 'failed', finished_at = now()
      WHERE status = 'running' AND created_at < now() - make_interval(mins => ${STALE_RUN_MINUTES})
      RETURNING id, access_code_id
    ),
    refunded AS (
      UPDATE access_codes
      SET credits_balance = credits_balance + ${REPORT_COST}
      WHERE id IN (SELECT access_code_id FROM stale) AND label != ${OPERATOR_CODE_LABEL}
      RETURNING id
    )
    INSERT INTO credit_ledger (access_code_id, delta, reason, report_id)
    SELECT stale.access_code_id, ${REPORT_COST}, 'refund', stale.id
    FROM stale
    JOIN refunded ON refunded.id = stale.access_code_id
  `);
}
