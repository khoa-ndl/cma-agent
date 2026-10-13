"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AddressMatch } from "@/lib/data/provider";
import type { Subject } from "@/lib/engine/adjustments";
import type { ReportStreamEvent } from "@/app/api/reports/logic";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { readSse } from "./sse";

const CONDITIONS: Subject["propertyCondition"][] = ["Excellent", "Good", "Fair", "Poor"];

// The happy-path tool order (spec 4.3's agent loop can repeat or skip
// around this on retries, so progress is "how many of these have a
// confirmed result so far", not a strict step index).
const STEP_ORDER = ["search_comps", "compute_adjustments", "compute_price_range", "submit_cma"];

const TOOL_COPY: Record<string, string> = {
  search_comps: "Searching comparable sales",
  compute_adjustments: "Computing adjustments",
  compute_price_range: "Computing the price range",
  submit_cma: "Finalizing the report",
};

// Reset to blank 4s after a successful run shows its "done" state, unless
// the operator dismisses it sooner — long enough to read, short enough
// not to block the next CMA.
const DONE_RESET_MS = 4000;

function describe(event: ReportStreamEvent): string {
  if (event.type === "tool_call") return `${TOOL_COPY[event.tool] ?? event.tool}…`;
  if (event.type === "tool_result") return event.ok ? "Done." : "Hit a snag — retrying.";
  return "Finishing up…";
}

// Monotonic within one run (a retried tool can't un-complete an earlier
// one), capped below 100 until the server's own "done" event confirms it
// -- a real tool_result is not the same guarantee as the run having
// actually finished and been persisted.
function computeProgress(events: ReportStreamEvent[]): number {
  const completed = new Set(
    events
      .filter((event): event is Extract<ReportStreamEvent, { type: "tool_result" }> => event.type === "tool_result" && event.ok)
      .map((event) => event.tool),
  );
  const stepsDone = STEP_ORDER.filter((step) => completed.has(step)).length;
  const pending = events.some((event) => event.type === "tool_call" && !completed.has(event.tool));
  const fraction = (stepsDone + (pending ? 0.5 : 0)) / STEP_ORDER.length;
  return Math.min(95, Math.round(fraction * 100));
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-muted)">
      <div
        className="h-full rounded-full bg-(--color-primary) transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function NewCmaForm({
  creditsBalance,
  endpoint = "/api/reports",
  resultBasePath = "/cma",
  unmetered = false,
}: {
  creditsBalance?: number;
  endpoint?: string;
  resultBasePath?: string;
  unmetered?: boolean;
}) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [events, setEvents] = useState<ReportStreamEvent[]>([]);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Remounts AddressAutocomplete on reset -- it owns its own query/matches
  // state internally, which clearing subject/address alone can't touch.
  const [formKey, setFormKey] = useState(0);
  // The URL this form was loaded at, so a reset can restore it after the
  // in-flight replaceState swap to the report's own URL (below).
  const originalPathRef = useRef<string | null>(null);

  const canSubmit = subject !== null && phase === "idle" && (unmetered || (creditsBalance ?? 0) >= 5);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(resetForm, DONE_RESET_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  function resetForm() {
    setPhase("idle");
    setEvents([]);
    setSubject(null);
    setAddress(null);
    setReportId(null);
    setError(null);
    setFormKey((k) => k + 1);
    if (originalPathRef.current) {
      window.history.replaceState(null, "", originalPathRef.current);
    }
  }

  function handleSelect(match: AddressMatch) {
    setAddress(match.unparsedAddress);
    setSubject({
      latitude: match.latitude,
      longitude: match.longitude,
      mlsAreaMajor: match.mlsAreaMajor,
      propertySubType: match.propertySubType,
      bedroomsTotal: match.bedroomsTotal,
      bathroomsTotalInteger: match.bathroomsTotalInteger,
      livingArea: match.livingArea,
      lotSizeSquareFeet: match.lotSizeSquareFeet,
      yearBuilt: match.yearBuilt,
      garageSpaces: match.garageSpaces,
      propertyCondition: match.propertyCondition,
    });
  }

  function updateSubject(patch: Partial<Subject>) {
    setSubject((current) => (current ? { ...current, ...patch } : current));
  }

  async function handleSubmit() {
    if (!subject) return;
    setError(null);
    setEvents([]);
    setReportId(null);
    setPhase("running");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subject, unparsedAddress: address }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { reason?: string } | null;
        setError(body?.reason ?? "Couldn't start the report. Try again.");
        setPhase("idle");
        return;
      }

      const id = response.headers.get("X-Report-Id");
      if (id) {
        setReportId(id);
        // Keeps this same component (and its open stream) mounted while
        // making the URL reflect the run, so a refresh mid-run lands on
        // the results page's own status view instead of back on this
        // form. resetForm() restores the original URL once the overlay
        // closes, since by then the page is showing the blank form again.
        originalPathRef.current = window.location.pathname;
        window.history.replaceState(null, "", `${resultBasePath}/${id}`);
      }

      await readSse(response, (data) => {
        const event = data as ReportStreamEvent;
        setEvents((prev) => [...prev, event]);
        if (event.type === "done") {
          setPhase(event.outcome.status === "succeeded" ? "done" : "failed");
        }
      });

      // The stream closed without ever sending "done" -- a dropped
      // connection rather than a real failure. The report may still be
      // running server-side; land back on idle rather than claiming it
      // failed, same posture as the pre-overlay version's fallback.
      setPhase((current) => (current === "running" ? "idle" : current));
    } catch {
      setError("Lost the connection. Check your network and try again.");
      setPhase("idle");
    }
  }

  const progress = phase === "done" ? 100 : computeProgress(events);

  return (
    <>
      <div className="flex w-full max-w-lg flex-col gap-6">
        {!unmetered && (
          <p className="text-sm text-(--color-muted-foreground)">
            {creditsBalance} report{creditsBalance === 1 ? "" : "s"} remaining
          </p>
        )}

        <AddressAutocomplete key={formKey} onSelect={handleSelect} />

        {subject && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bedrooms">
              <input
                type="number"
                min={0}
                value={subject.bedroomsTotal}
                onChange={(e) => updateSubject({ bedroomsTotal: Number(e.target.value) })}
                className="w-full rounded-lg border border-(--color-border) px-3 py-2"
              />
            </Field>
            <Field label="Bathrooms">
              <input
                type="number"
                min={0}
                value={subject.bathroomsTotalInteger}
                onChange={(e) => updateSubject({ bathroomsTotalInteger: Number(e.target.value) })}
                className="w-full rounded-lg border border-(--color-border) px-3 py-2"
              />
            </Field>
            <Field label="Living area (sq ft)">
              <input
                type="number"
                min={1}
                value={subject.livingArea}
                onChange={(e) => updateSubject({ livingArea: Number(e.target.value) })}
                className="w-full rounded-lg border border-(--color-border) px-3 py-2"
              />
            </Field>
            <Field label="Lot size (sq ft)">
              <input
                type="number"
                min={0}
                value={subject.lotSizeSquareFeet ?? ""}
                placeholder="N/A for condos"
                onChange={(e) => updateSubject({ lotSizeSquareFeet: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-lg border border-(--color-border) px-3 py-2"
              />
            </Field>
            <Field label="Year built">
              <input
                type="number"
                min={1800}
                value={subject.yearBuilt}
                onChange={(e) => updateSubject({ yearBuilt: Number(e.target.value) })}
                className="w-full rounded-lg border border-(--color-border) px-3 py-2"
              />
            </Field>
            <Field label="Garage spaces">
              <input
                type="number"
                min={0}
                value={subject.garageSpaces}
                onChange={(e) => updateSubject({ garageSpaces: Number(e.target.value) })}
                className="w-full rounded-lg border border-(--color-border) px-3 py-2"
              />
            </Field>
            <Field label="Condition">
              <select
                value={subject.propertyCondition}
                onChange={(e) => updateSubject({ propertyCondition: e.target.value as Subject["propertyCondition"] })}
                className="w-full rounded-lg border border-(--color-border) px-3 py-2"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-(--color-destructive)">
            {error}
          </p>
        )}

        {!unmetered && (creditsBalance ?? 0) < 5 && (
          <p className="text-sm text-(--color-destructive)">Not enough credits for a report.</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="min-h-11 cursor-pointer rounded-lg bg-(--color-primary) px-5 py-3 font-semibold text-(--color-on-primary) transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate CMA
        </button>
      </div>

      {phase !== "idle" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CMA generation progress"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <div className="flex w-[90%] max-w-md flex-col gap-4 rounded-2xl bg-(--color-card) p-8 shadow-xl">
            {phase === "running" && (
              <>
                <h2 className="text-lg font-semibold text-(--color-foreground)">Working on your CMA…</h2>
                <ProgressBar percent={progress} />
                <p className="text-sm text-(--color-muted-foreground)">{progress}% complete</p>
                <ul className="flex flex-col gap-1 text-sm text-(--color-muted-foreground)">
                  {events.map((event, i) => (
                    <li key={i}>{describe(event)}</li>
                  ))}
                </ul>
              </>
            )}

            {phase === "done" && (
              <>
                <h2 className="text-lg font-semibold text-(--color-foreground)">Report ready</h2>
                <ProgressBar percent={100} />
                <div className="flex items-center gap-3">
                  {reportId && (
                    <Link
                      href={`${resultBasePath}/${reportId}`}
                      className="min-h-11 cursor-pointer rounded-lg bg-(--color-primary) px-5 py-3 text-sm font-semibold text-(--color-on-primary) transition-opacity duration-200 hover:opacity-90"
                    >
                      View report
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={resetForm}
                    className="cursor-pointer text-sm font-medium text-(--color-muted-foreground) underline hover:text-(--color-foreground)"
                  >
                    Start another now
                  </button>
                </div>
              </>
            )}

            {phase === "failed" && (
              <>
                <h2 className="text-lg font-semibold text-(--color-destructive)">This report didn&apos;t complete</h2>
                <p className="text-sm text-(--color-muted-foreground)">
                  {unmetered
                    ? "Something went wrong partway through. You can start a new report."
                    : "Something went wrong partway through. Your credits were refunded — you can start a new report."}
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="min-h-11 w-fit cursor-pointer rounded-lg border border-(--color-border) px-5 py-3 text-sm font-semibold text-(--color-foreground) transition-opacity duration-200 hover:opacity-80"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-(--color-foreground)">
      {label}
      {children}
    </label>
  );
}
