// Unmetered operator-generated reports (operator-dashboard spec.md §3,
// §4 screen 5): attached to one reserved, lazily-created access code,
// never going through reserveCredits -- no balance deduction, no
// ledger entry, since the whole point is it's never charged (D6).
import { eq } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { accessCodes, reports } from "@/lib/db/schema";
import { OPERATOR_CODE_LABEL } from "@/lib/credits/access";
import { sweepStaleRuns } from "@/lib/credits/credits";

export { OPERATOR_CODE_LABEL };

// A fixed, random 256-bit constant -- generated once (`openssl rand
// -hex 32`), never derived from OPERATOR_CODE_LABEL or anything else
// a login attempt could type. code_hash doubles as checkAccessCode's
// authentication secret, and hashAccessCode's normalization (strip
// dashes, uppercase) is deterministic, so hashing the sentinel's own
// label would mean typing the literal, publicly-documented string
// "__operator__" into the real login form authenticates as the
// sentinel -- confirmed as a real, working login before this fix.
// This constant must stay fixed across restarts (so ensureOperator-
// AccessCode's find-by-hash lookup keeps finding the same row --
// unlike a per-process-random value, which would "lose" the sentinel
// on every cold start and create a new one each time), while being as
// unguessable as a real access code. Reuses access_codes' existing
// unique index on code_hash as the race guard below, so no schema
// change is needed.
const OPERATOR_CODE_HASH = "4a6868285bcbbb28415072f03d4e0d37c7a97577b36ce9578a23361d72cea3cf";

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
