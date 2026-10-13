import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listReports, type ReportListItem } from "@/app/api/reports/logic";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../../api/_lib/session";

// Session-gated on every load; see cma/[id]/page.tsx's note on why this
// opts out of instant-navigation validation instead of streaming.
export const instant = false;

const STATUS_LABEL: Record<ReportListItem["status"], string> = {
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

export default async function ReportsListPage() {
  await connection();
  const cookieStore = await cookies();
  const accessCodeId = resolveAccessCodeId(cookieStore.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  if (!accessCodeId) {
    redirect("/");
  }

  const result = await listReports(getDb(), accessCodeId);
  const { reports } = result.body as { reports: ReportListItem[] };

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold text-(--color-foreground)">Reports Generated</h1>

      {reports.length === 0 ? (
        <p className="text-(--color-muted-foreground)">
          No reports yet. Start one from <Link href="/cma/new" className="text-(--color-primary) underline">New CMA</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl text-left text-sm">
            <thead className="text-(--color-muted-foreground)">
              <tr>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-t border-(--color-border)">
                  <td className="py-2 pr-4">
                    <Link href={`/cma/${report.id}`} className="text-(--color-primary) hover:underline">
                      {report.unparsedAddress ?? report.mlsAreaMajor ?? "Untitled report"}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{STATUS_LABEL[report.status]}</td>
                  <td className="py-2 pr-4 text-(--color-muted-foreground)">
                    {report.createdAt.toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
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
