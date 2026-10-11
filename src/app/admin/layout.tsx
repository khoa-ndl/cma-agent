import { connection } from "next/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { isAdminSession } from "../api/_lib/admin-session";
import { LogoutButton } from "../_components/LogoutButton";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/codes", label: "Codes" },
  { href: "/admin/reports", label: "Reports & costs" },
  { href: "/admin/new", label: "New CMA" },
];

// Reads the admin session cookie on every load, to decide whether the
// sidebar renders at all (decision: login screen stays bare) — see
// page.tsx's note on why this opts out of instant-navigation validation.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  const isAdmin = isAdminSession(await cookies());

  if (!isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1">
      <nav className="w-56 shrink-0 border-r border-(--color-border) px-4 py-8">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-(--color-foreground) hover:bg-(--color-muted)"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="mt-4 border-t border-(--color-border) pt-4">
            <LogoutButton endpoint="/api/admin/session" redirectTo="/admin" />
          </li>
        </ul>
      </nav>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
