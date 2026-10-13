// GET /api/reports/[id] (spec 5 screen 3, A6): lets the browser recover
// a run's status after a dropped SSE connection. Scoped to the session's
// own accessCodeId — a report owned by someone else returns 404, not
// 403, so a guessed id can't even confirm another code's report exists.
import { eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";
import type { CmaResult } from "@/lib/agent/tools";
import { createSampleDataProvider } from "@/lib/data/sample-provider";

/** The success-case body shape, reused by the UI so the Server
 * Component's initial fetch and the client's polling fallback agree on
 * one type. */
export interface ReportBody {
  id: string;
  status: "running" | "succeeded" | "failed";
  subject: unknown;
  result: CmaResult | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  costUsd: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  /** Real-world coordinates for the comp map (not part of the stored
   * CmaResult, which never has lat/long) -- looked up from the `property`
   * table by listingKey at render time rather than stored, so old reports
   * get this for free and the agent's output shape stays untouched. Only
   * set for a succeeded report with a result; a running/failed report has
   * nothing to map. */
  mapPositions?: {
    subject: { latitude: number; longitude: number } | null;
    comps: Array<{ listingKey: string; latitude: number; longitude: number }>;
  };
}

export interface ReportStatusResult {
  status: number;
  body: unknown;
}

export async function getReport<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  reportId: string,
  accessCodeId: string | null,
): Promise<ReportStatusResult> {
  if (!accessCodeId) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  const [row] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!row || row.accessCodeId !== accessCodeId) {
    return { status: 404, body: { reason: "not_found" } };
  }

  const result = row.result as CmaResult | null;

  const body: ReportBody = {
    id: row.id,
    status: row.status,
    subject: row.subject,
    result,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cacheReadTokens: row.cacheReadTokens,
    costUsd: row.costUsd,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };

  if (row.status === "succeeded" && result) {
    const provider = createSampleDataProvider(db);
    const sourceListingKey = (row.subject as { sourceListingKey?: string } | null)?.sourceListingKey;
    const selectedComps = Array.isArray(result.selectedComps) ? result.selectedComps : [];

    const [subjectProperty, compProperties] = await Promise.all([
      sourceListingKey ? provider.getProperty(sourceListingKey) : Promise.resolve(null),
      Promise.all(selectedComps.map((c) => provider.getProperty(c.listingKey))),
    ]);

    body.mapPositions = {
      subject: subjectProperty ? { latitude: subjectProperty.latitude, longitude: subjectProperty.longitude } : null,
      comps: selectedComps
        .map((c, i) => {
          const found = compProperties[i];
          return found ? { listingKey: c.listingKey, latitude: found.latitude, longitude: found.longitude } : null;
        })
        .filter((c): c is { listingKey: string; latitude: number; longitude: number } => c !== null),
    };
  }

  return { status: 200, body };
}
