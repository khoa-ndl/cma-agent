// Unmetered operator-generated reports (operator-dashboard spec.md §3,
// §4 screen 5): attached to one reserved, lazily-created access code,
// never going through reserveCredits -- no balance deduction, no
// ledger entry, since the whole point is it's never charged (D6).
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { accessCodes, reports } from "@/lib/db/schema";
import { hashAccessCode, OPERATOR_CODE_LABEL } from "@/lib/credits/access";
import { sweepStaleRuns } from "@/lib/credits/credits";

export { OPERATOR_CODE_LABEL };

// Deterministic, never a real issued code's hash (those come from
// generateAccessCode's 128 bits of real randomness) -- this doubles
// as the race guard below, reusing access_codes' existing unique
// index on code_hash instead of adding a new constraint.
const OPERATOR_CODE_HASH = hashAccessCode(OPERATOR_CODE_LABEL);

/** Finds or lazily creates the sentinel. Two callers racing to create
 * it both attempt the same deterministic codeHash; the loser's insert
 * fails on the existing unique index, so it just re-selects instead of
 * throwing or creating a duplicate. */
export async function ensureOperatorAccessCode(db: Database): Promise<string> {
  const [existing] = await db.select({ id: accessCodes.id }).from(accessCodes).where(eq(accessCodes.codeHash, OPERATOR_CODE_HASH)).limit(1);
  if (existing) return existing.id;

  try {
    const [created] = await db
      .insert(accessCodes)
      .values({ codeHash: OPERATOR_CODE_HASH, label: OPERATOR_CODE_LABEL, creditsBalance: 0 })
      .returning({ id: accessCodes.id });
    return created.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const [winner] = await db.select({ id: accessCodes.id }).from(accessCodes).where(eq(accessCodes.codeHash, OPERATOR_CODE_HASH)).limit(1);
    if (!winner) throw new Error("Failed to create or find the operator sentinel access code.");
    return winner.id;
  }
}

export type CreateOperatorReportResult = { ok: true; reportId: string } | { ok: false; reason: "already_running" };

/** Inserts the report row directly -- no reserveCredits call, so no
 * balance is ever touched and no credit_ledger row is ever written.
 * The partial unique index (one running report per code) still
 * applies to the sentinel like any other code, so a second concurrent
 * operator report is caught here and reported the same way a
 * customer's would be, instead of throwing. */
export async function createOperatorReport(
  db: Database,
  subject: Record<string, unknown>,
): Promise<CreateOperatorReportResult> {
  await sweepStaleRuns(db);
  const operatorCodeId = await ensureOperatorAccessCode(db);

  try {
    const [created] = await db
      .insert(reports)
      .values({ accessCodeId: operatorCodeId, status: "running", subject })
      .returning({ id: reports.id });
    return { ok: true, reportId: created.id };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "already_running" };
    throw err;
  }
}

// Postgres's unique_violation SQLSTATE. Drizzle wraps the driver's own
// error in a DrizzleQueryError, with the original (which carries
// `.code`) as its `.cause` -- confirmed against the actual error this
// insert throws, not assumed from the driver's docs alone.
function isUniqueViolation(err: unknown): boolean {
  return hasCode(err, "23505") || hasCode((err as { cause?: unknown })?.cause, "23505");
}

function hasCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === code;
}
