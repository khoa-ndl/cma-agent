import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE_NAME, resolveAdminSession } from "../../api/_lib/admin-session";
import { requireSessionSecret } from "../../api/_lib/session";
import { NewCmaForm } from "../../_components/NewCmaForm";

export const instant = false;

export default async function AdminNewCmaPage() {
  await connection();
  const cookieStore = await cookies();
  const isAdmin = resolveAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value, requireSessionSecret());
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
