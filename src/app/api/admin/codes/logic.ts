// GET/POST /api/admin/codes (operator-dashboard spec.md §4 screen 3):
// lists every issued code and issues new ones, mirroring the
// handleAccessRequest/getReport DI pattern used everywhere else.
import { z } from "zod";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { issueAccessCode, listCustomerAccessCodes, type CustomerAccessCode } from "@/lib/credits/access";

export interface AdminCodesResult {
  status: number;
  body: unknown;
}

export async function listAdminCodes<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  isAdmin: boolean,
): Promise<AdminCodesResult> {
  if (!isAdmin) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  const codes: CustomerAccessCode[] = await listCustomerAccessCodes(db);
  return { status: 200, body: { codes } };
}

const issueRequestSchema = z.object({
  label: z.string().min(1).max(200),
  credits: z.number().int().nonnegative(),
});

export interface IssueCodeResult {
  status: number;
  body: { code: string; accessCodeId: string } | { reason: string };
}

export async function handleIssueCode<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  body: unknown,
  isAdmin: boolean,
): Promise<IssueCodeResult> {
  if (!isAdmin) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  const parsed = issueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { reason: "invalid_request" } };
  }

  const { code, accessCodeId } = await issueAccessCode(db, parsed.data.label, parsed.data.credits);
  return { status: 200, body: { code, accessCodeId } };
}
