import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getAccessCodeStatus } from "@/lib/credits/access";
import { listReports, type ReportListItem } from "@/app/api/reports/logic";
import { SESSION_COOKIE_NAME, resolveAccessCodeId, requireSessionSecret } from "../api/_lib/session";

const RECENT_REPORTS_LIMIT = 5;

// Session- and balance-gated on every load; see cma/[id]/page.tsx's note
// on why this opts out of instant-navigation validation instead of streaming.
export const instant = false;

export default async function CmaHomePage() {
  await connection();
  const cookieStore = await cookies();
  const accessCodeId = resolveAccessCodeId(cookieStore.get(SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  if (!accessCodeId) {
    redirect("/");
  }

  const status = await getAccessCodeStatus(getDb(), accessCodeId);
  if (!status || status.revoked) {
    redirect("/");
  }

  const result = await listReports(getDb(), accessCodeId, RECENT_REPORTS_LIMIT);
  const { reports } = result.body as { reports: ReportListItem[] };

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold text-(--color-foreground)">Home</h1>

      <section className="rounded-lg border border-(--color-border) bg-(--color-card) p-6">
        <p className="text-sm text-(--color-muted-foreground)">Credit balance</p>
        <p className="text-2xl font-semibold text-(--color-foreground)">
          {status.creditsBalance} report{status.creditsBalance === 1 ? "" : "s"} remaining
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-(--color-foreground)">Recent reports</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-(--color-muted-foreground)">No reports yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {reports.map((report) => (
              <li key={report.id}>
                <Link href={`/cma/${report.id}`} className="text-(--color-primary) hover:underline">
                  {report.unparsedAddress ?? report.mlsAreaMajor ?? "Untitled report"}
                </Link>
                <span className="ml-2 text-(--color-muted-foreground)">
                  {report.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/cma/new"
        className="min-h-11 w-fit cursor-pointer rounded-lg bg-(--color-primary) px-5 py-3 font-semibold text-(--color-on-primary) transition-opacity duration-200 hover:opacity-90"
      >
        Start new CMA
      </Link>
    </main>
  );
}
