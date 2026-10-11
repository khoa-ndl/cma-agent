import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminSession } from "../../api/_lib/admin-session";
import { NewCmaForm } from "../../_components/NewCmaForm";

export const instant = false;

export default async function AdminNewCmaPage() {
  await connection();
  const isAdmin = isAdminSession(await cookies());
  if (!isAdmin) {
    redirect("/admin");
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-4 py-16">
      <h1 className="text-2xl font-semibold text-(--color-foreground)">New CMA (operator, unmetered)</h1>
      <NewCmaForm endpoint="/api/admin/reports" resultBasePath="/admin/reports" unmetered />
    </main>
  );
}
