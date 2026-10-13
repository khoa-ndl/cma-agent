import { connection } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { isAdminSession } from "../api/_lib/admin-session";
import { getAdminOverview, type AdminOverview } from "../api/admin/overview/logic";
import { AdminLoginForm } from "../_components/AdminLoginForm";

// Session-gated on every load; see cma/[id]/page.tsx's note on why this
// opts out of instant-navigation validation instead of streaming.
export const instant = false;

export default async function AdminPage() {
  await connection();
  const isAdmin = isAdminSession(await cookies());

  if (!isAdmin) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
        <div className="flex max-w-md flex-col gap-3 text-center">
          <h1 className="text-2xl font-semibold text-(--color-foreground)">Operator login</h1>
        </div>
        <AdminLoginForm />
      </main>
    );
  }

  const result = await getAdminOverview(getDb(), true);
  const overview = result.body as AdminOverview;

  return (
    <main className="flex flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold text-(--color-foreground)">Overview</h1>

      <section className="flex flex-wrap gap-4">
        <div className="min-w-[220px] rounded-lg border border-(--color-border) bg-(--color-card) p-6 shadow-sm">
          <p className="text-sm text-(--color-muted-foreground)">Database</p>
          <div className="mt-2 flex items-center gap-2">
            {overview.health === "ok" ? (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-(--color-primary)">
                <path d="M10 1a9 9 0 100 18 9 9 0 000-18zm4.28 6.53-5 5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06l1.97 1.97 4.47-4.47a.75.75 0 1 1 1.06 1.06z" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-(--color-destructive)">
                <path d="M10 1a9 9 0 100 18 9 9 0 000-18zm0 4a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0V6a1 1 0 0 1 1-1zm0 9.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z" />
              </svg>
            )}
            <p
              className={
                overview.health === "ok"
                  ? "font-heading text-3xl font-bold text-(--color-foreground)"
                  : "font-heading text-3xl font-bold text-(--color-destructive)"
              }
            >
              {overview.health === "ok" ? "Healthy" : "Unavailable"}
            </p>
          </div>
        </div>
        <div className="min-w-[220px] rounded-lg border border-(--color-border) bg-(--color-card) p-6 shadow-sm">
          <p className="text-sm text-(--color-muted-foreground)">Spend this month</p>
          <p className="mt-2 font-heading text-3xl font-bold text-(--color-foreground)">
            ${overview.monthlySpendUsd.toFixed(2)}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-(--color-foreground)">Stuck reports</h2>
        {overview.stuckReports.length === 0 ? (
          <p className="text-sm text-(--color-muted-foreground)">None right now.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-(--color-foreground)">
            {overview.stuckReports.map((report) => (
              <li key={report.id}>
                {report.codeLabel} — running {report.ageMinutes} min
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-(--color-foreground)">Low-balance codes</h2>
        {overview.lowBalanceCodes.length === 0 ? (
          <p className="text-sm text-(--color-muted-foreground)">None right now.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-(--color-foreground)">
            {overview.lowBalanceCodes.map((code) => (
              <li key={code.id}>
                {code.label} — {code.creditsBalance} credit{code.creditsBalance === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
