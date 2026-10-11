// POST /api/admin/codes/[id]/revoke (operator-dashboard spec.md §4
// screen 3): one-way revocation (no "un-revoke" -- spec decision).
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { revokeAccessCode } from "@/lib/credits/access";

export interface RevokeCodeResult {
  status: number;
  body: { ok: true } | { reason: string };
}

export async function handleRevokeCode<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  accessCodeId: string,
  isAdmin: boolean,
): Promise<RevokeCodeResult> {
  if (!isAdmin) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  await revokeAccessCode(db, accessCodeId);
  return { status: 200, body: { ok: true } };
}
