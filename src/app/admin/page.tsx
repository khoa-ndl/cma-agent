import { connection } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "../api/_lib/admin-session";
import { requireSessionSecret } from "../api/_lib/session";
import { getAdminOverview, type AdminOverview } from "../api/admin/overview/logic";
import { AdminLoginForm } from "../_components/AdminLoginForm";

// Session-gated on every load; see cma/[id]/page.tsx's note on why this
// opts out of instant-navigation validation instead of streaming.
export const instant = false;

export default async function AdminPage() {
  await connection();
  const cookieStore = await cookies();
  const isAdmin = resolveAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());

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
        <div className="rounded-lg border border-(--color-border) bg-(--color-card) p-6">
          <p className="text-sm text-(--color-muted-foreground)">Database</p>
          <p
            className={
              overview.health === "ok"
                ? "text-lg font-semibold text-(--color-foreground)"
                : "text-lg font-semibold text-(--color-destructive)"
            }
          >
            {overview.health === "ok" ? "Healthy" : "Unavailable"}
          </p>
        </div>
        <div className="rounded-lg border border-(--color-border) bg-(--color-card) p-6">
          <p className="text-sm text-(--color-muted-foreground)">Spend this month</p>
          <p className="text-lg font-semibold text-(--color-foreground)">${overview.monthlySpendUsd.toFixed(2)}</p>
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
