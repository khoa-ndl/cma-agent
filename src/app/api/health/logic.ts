// GET /api/health (A15): a trivial round trip, nothing more — an uptime
// monitor hitting this on a schedule shouldn't itself burn Neon's free
// compute-hours (spec C2).
import { sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";

export interface HealthResult {
  status: number;
  body: { status: "ok" | "unavailable" };
}

export async function checkHealth<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
): Promise<HealthResult> {
  try {
    await db.execute(sql`select 1`);
    return { status: 200, body: { status: "ok" } };
  } catch {
    return { status: 503, body: { status: "unavailable" } };
  }
}
