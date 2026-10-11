"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function IssueCodeForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [credits, setCredits] = useState(45);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setIssuedCode(null);

    try {
      const response = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, credits }),
      });

      if (!response.ok) {
        setError("Couldn't issue a code. Check the label and try again.");
        return;
      }

      const body = (await response.json()) as { code: string };
      setIssuedCode(body.code);
      setLabel("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-(--color-border) bg-(--color-card) p-6">
      <h2 className="text-lg font-semibold text-(--color-foreground)">Issue a new code</h2>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-(--color-foreground)">
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Jane @ Acme"
            disabled={submitting}
            className="w-56 rounded-lg border border-(--color-border) px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-(--color-foreground)">
          Credits
          <input
            type="number"
            min={0}
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            disabled={submitting}
            className="w-28 rounded-lg border border-(--color-border) px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || label.trim().length === 0}
          className="min-h-11 cursor-pointer rounded-lg bg-(--color-primary) px-5 py-2.5 font-semibold text-(--color-on-primary) transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Issuing…" : "Issue code"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-(--color-destructive)">
          {error}
        </p>
      )}

      {issuedCode && (
        <div className="rounded-lg bg-(--color-muted) p-4 text-sm text-(--color-foreground)">
          <p className="font-medium">Shown once — store it securely and send it to the recipient:</p>
          <p className="mt-1 font-mono text-base">{issuedCode}</p>
        </div>
      )}
    </form>
  );
}
