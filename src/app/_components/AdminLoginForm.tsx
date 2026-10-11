"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const ERROR_COPY: Record<string, string> = {
  invalid_request: "Enter the admin password.",
  invalid: "That password isn't correct.",
  rate_limited: "Too many attempts from this connection. Try again in a few minutes.",
};

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.refresh();
        return;
      }

      const body = (await response.json().catch(() => null)) as { reason?: string } | null;
      setError((body?.reason && ERROR_COPY[body.reason]) ?? "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="admin-password" className="text-sm font-medium text-(--color-foreground)">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          aria-describedby={error ? "admin-password-error" : undefined}
          className="rounded-lg border border-(--color-border) px-4 py-3 text-base text-(--color-foreground) outline-none focus:border-(--color-ring) focus:ring-3 focus:ring-(--color-ring)/20"
        />
        {error && (
          <p id="admin-password-error" role="alert" className="text-sm text-(--color-destructive)">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="min-h-11 cursor-pointer rounded-lg bg-(--color-primary) px-5 py-3 font-semibold text-(--color-on-primary) transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
