import { connection } from "next/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getAdminReport } from "@/app/api/admin/reports/[id]/logic";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "../../../api/_lib/admin-session";
import { requireSessionSecret } from "../../../api/_lib/session";
import { ReportView, type ReportBody } from "../../../_components/ReportView";

export const instant = false;

export default async function AdminReportPage(props: PageProps<"/admin/reports/[id]">) {
  await connection();
  const { id } = await props.params;
  const cookieStore = await cookies();
  const isAdmin = resolveAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());
  if (!isAdmin) {
    redirect("/admin");
  }

  const result = await getAdminReport(getDb(), id, true);
  if (result.status === 404) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 py-16">
      <ReportView reportId={id} initial={result.body as ReportBody} apiBasePath="/api/admin/reports" />
    </main>
  );
}
