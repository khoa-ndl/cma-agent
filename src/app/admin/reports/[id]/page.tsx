import { connection } from "next/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getAdminReport } from "@/app/api/admin/reports/[id]/logic";
import { isAdminSession } from "../../../api/_lib/admin-session";
import { ReportView, type ReportBody } from "../../../_components/ReportView";

export const instant = false;

export default async function AdminReportPage(props: PageProps<"/admin/reports/[id]">) {
  await connection();
  const { id } = await props.params;
  const isAdmin = isAdminSession(await cookies());
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
