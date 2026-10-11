// GET /api/reports/[id]/pdf (spec 5 screen 5, A7): renders the finished
// report as a PDF. Reuses getReport's auth and ownership check — a report
// owned by another code 404s here too, same as the status endpoint.
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/db/client";
import type { Subject } from "@/lib/engine/adjustments";
import { ReportDocument } from "@/lib/pdf/report-document";
import { getReport, type ReportBody } from "../logic";

export type PdfResult =
  | { kind: "error"; status: number; body: unknown }
  | { kind: "pdf"; status: 200; buffer: Buffer };

export async function renderReportPdf<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  reportId: string,
  accessCodeId: string | null,
): Promise<PdfResult> {
  const result = await getReport(db, reportId, accessCodeId);
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
