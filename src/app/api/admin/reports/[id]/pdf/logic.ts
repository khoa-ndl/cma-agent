// GET /api/admin/reports/[id]/pdf (operator-dashboard spec.md, decision:
// "admin PDF route works for any report"): reuses getAdminReport's gate
// instead of getReport's ownership check.
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/db/client";
import type { Subject } from "@/lib/engine/adjustments";
import type { ReportBody } from "@/app/api/reports/[id]/logic";
import { ReportDocument } from "@/lib/pdf/report-document";
import { getAdminReport } from "../logic";

export type AdminPdfResult =
  | { kind: "error"; status: number; body: unknown }
  | { kind: "pdf"; status: 200; buffer: Buffer };

export async function renderAdminReportPdf<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  reportId: string,
  isAdmin: boolean,
): Promise<AdminPdfResult> {
  const result = await getAdminReport(db, reportId, isAdmin);
  if (result.status !== 200) {
    return { kind: "error", status: result.status, body: result.body };
  }

  const body = result.body as ReportBody;
  if (body.status !== "succeeded" || !body.result) {
    return { kind: "error", status: 409, body: { reason: "not_ready" } };
  }

  const buffer = await renderToBuffer(ReportDocument({ subject: body.subject as Subject, result: body.result }));
  return { kind: "pdf", status: 200, buffer };
}
