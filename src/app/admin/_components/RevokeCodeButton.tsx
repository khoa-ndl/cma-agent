"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeCodeButton({ accessCodeId, revoked }: { accessCodeId: string; revoked: boolean }) {
  const router = useRouter();
  const [revoking, setRevoking] = useState(false);

  async function handleRevoke() {
    if (!window.confirm("Revoke this code? This can't be undone.")) return;
    setRevoking(true);
    try {
      await fetch(`/api/admin/codes/${accessCodeId}/revoke`, { method: "POST" });
      router.refresh();
    } finally {
      setRevoking(false);
    }
  }

  if (revoked) {
    return <span className="text-sm text-(--color-muted-foreground)">Revoked</span>;
  }

  return (
    <button
      type="button"
      onClick={handleRevoke}
      disabled={revoking}
      className="cursor-pointer text-sm font-medium text-(--color-destructive) transition-opacity duration-200 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {revoking ? "Revoking…" : "Revoke"}
    </button>
  );
}
