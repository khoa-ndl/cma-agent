"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeCodeButton({ accessCodeId, revoked }: { accessCodeId: string; revoked: boolean }) {
  const router = useRouter();
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState(false);

  async function handleRevoke() {
    if (!window.confirm("Revoke this code? This can't be undone.")) return;
    setRevoking(true);
    setError(false);
    try {
      const response = await fetch(`/api/admin/codes/${accessCodeId}/revoke`, { method: "POST" });
      if (!response.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setRevoking(false);
    }
  }

  if (revoked) {
    return <span className="text-sm text-(--color-muted-foreground)">Revoked</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleRevoke}
        disabled={revoking}
        className="cursor-pointer text-sm font-medium text-(--color-destructive) transition-opacity duration-200 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {revoking ? "Revoking…" : "Revoke"}
      </button>
      {error && <p role="alert" className="text-xs text-(--color-destructive)">Couldn&apos;t revoke. Try again.</p>}
    </div>
  );
}
