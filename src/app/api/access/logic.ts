// POST /api/access (spec 5 screen 1, 8): checks a submitted code and
// returns a session token for the route to set as a cookie. Framework-
// agnostic — takes `db` directly so this is testable with the PGlite
// fixture, same DI pattern as every lib/ module.
import { z } from "zod";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { checkAccessCode } from "@/lib/credits/access";
import { createSessionToken } from "@/lib/credits/session";

const requestSchema = z.object({ code: z.string().min(1) });

export interface AccessRequestResult {
  status: number;
  body: { ok: true } | { ok: false; reason: string };
  sessionToken?: string;
}

const STATUS_BY_REASON: Record<string, number> = {
  invalid: 401,
  revoked: 401,
  rate_limited: 429,
};

export async function handleAccessRequest<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  body: unknown,
  ipAddress: string,
  secret: string,
): Promise<AccessRequestResult> {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, reason: "invalid_request" } };
  }

  const result = await checkAccessCode(db, parsed.data.code, ipAddress);
  if (!result.ok) {
    return { status: STATUS_BY_REASON[result.reason!] ?? 401, body: { ok: false, reason: result.reason! } };
  }

  return {
    status: 200,
    body: { ok: true },
    sessionToken: createSessionToken(result.accessCodeId!, secret),
  };
}
