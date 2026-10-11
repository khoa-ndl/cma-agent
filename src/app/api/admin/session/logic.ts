// POST /api/admin/session (operator-dashboard spec.md §4 screen 1): checks
// a submitted password and returns an admin session token for the route to
// set as a cookie. Same shape and DI pattern as handleAccessRequest.
import { z } from "zod";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { checkAdminLogin } from "@/lib/admin/login";
import { createAdminSessionToken } from "@/lib/admin/session";

const requestSchema = z.object({ password: z.string().min(1) });

export interface AdminLoginRequestResult {
  status: number;
  body: { ok: true } | { ok: false; reason: string };
  sessionToken?: string;
}

const STATUS_BY_REASON: Record<string, number> = {
  invalid: 401,
  rate_limited: 429,
};

export async function handleAdminLogin<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  body: unknown,
  ipAddress: string,
  secret: string,
  correctPassword: string,
): Promise<AdminLoginRequestResult> {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, reason: "invalid_request" } };
  }

  const result = await checkAdminLogin(db, parsed.data.password, ipAddress, correctPassword);
  if (!result.ok) {
    return { status: STATUS_BY_REASON[result.reason!] ?? 401, body: { ok: false, reason: result.reason! } };
  }

  return { status: 200, body: { ok: true }, sessionToken: createAdminSessionToken(secret) };
}
