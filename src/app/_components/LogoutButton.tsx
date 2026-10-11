"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ endpoint, redirectTo }: { endpoint: string; redirectTo: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(endpoint, { method: "DELETE" });
    } finally {
      router.push(redirectTo);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-medium text-(--color-foreground) transition-opacity duration-200 hover:bg-(--color-muted) disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loggingOut ? "Logging out…" : "Log out"}
    </button>
  );
}
