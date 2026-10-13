import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listAllReports, type AdminReportListItem } from "@/app/api/admin/reports/logic";
import { isAdminSession } from "../../api/_lib/admin-session";

export const instant = false;

const STATUS_LABEL: Record<AdminReportListItem["status"], string> = {
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

export default async function AdminReportsPage() {
  await connection();
  const isAdmin = isAdminSession(await cookies());
  if (!isAdmin) {
    redirect("/admin");
  }

  const result = await listAllReports(getDb(), true);
  const { reports } = result.body as { reports: AdminReportListItem[] };

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold text-(--color-foreground)">Reports &amp; costs</h1>

      {reports.length === 0 ? (
        <p className="text-(--color-muted-foreground)">No reports yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full max-w-4xl text-left text-sm">
            <thead className="text-(--color-muted-foreground)">
              <tr>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t border-(--color-border)">
                  <td className="py-2 pr-4">
                    <Link href={`/admin/reports/${report.id}`} className="text-(--color-primary) hover:underline">
                      {report.unparsedAddress ?? report.mlsAreaMajor ?? "Untitled report"}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{report.codeLabel}</td>
                  <td className="py-2 pr-4">{STATUS_LABEL[report.status]}</td>
                  <td className="py-2 pr-4">{report.costUsd ? `$${report.costUsd}` : "—"}</td>
                  <td className="py-2 pr-4 text-(--color-muted-foreground)">
                    {report.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
