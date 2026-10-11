import Link from "next/link";
import { LogoutButton } from "../_components/LogoutButton";

const NAV_ITEMS = [
  { href: "/cma", label: "Home" },
  { href: "/cma/new", label: "New CMA" },
  { href: "/cma/reports", label: "Reports Generated" },
];

export default function CmaLayout({ children }: LayoutProps<"/cma">) {
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
            <LogoutButton endpoint="/api/access" redirectTo="/" />
          </li>
        </ul>
      </nav>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
