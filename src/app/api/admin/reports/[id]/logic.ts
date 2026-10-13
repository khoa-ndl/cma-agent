// GET /api/admin/reports/[id] (operator-dashboard spec.md): the admin
// version of getReport, with no ownership scoping -- the admin session
// gate stands in for it, since "admin sees everything" (spec decision).
import { eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";
import type { ReportBody, ReportStatusResult } from "@/app/api/reports/[id]/logic";
import type { CmaResult } from "@/lib/agent/tools";
import { createSampleDataProvider } from "@/lib/data/sample-provider";

export async function getAdminReport<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  reportId: string,
  isAdmin: boolean,
): Promise<ReportStatusResult> {
  if (!isAdmin) {
    return { status: 401, body: { reason: "unauthenticated" } };
  }

  const [row] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!row) {
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
