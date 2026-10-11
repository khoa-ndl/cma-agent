"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AddressMatch } from "@/lib/data/provider";
import type { Subject } from "@/lib/engine/adjustments";
import type { ReportStreamEvent } from "@/app/api/reports/logic";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { readSse } from "./sse";

const CONDITIONS: Subject["propertyCondition"][] = ["Excellent", "Good", "Fair", "Poor"];

const TOOL_COPY: Record<string, string> = {
  search_comps: "Searching comparable sales",
  compute_adjustments: "Computing adjustments",
  compute_price_range: "Computing the price range",
  submit_cma: "Finalizing the report",
};

function describe(event: ReportStreamEvent): string {
  if (event.type === "tool_call") return `${TOOL_COPY[event.tool] ?? event.tool}…`;
  if (event.type === "tool_result") return event.ok ? "Done." : "Hit a snag — retrying.";
  return "Finishing up…";
}

export function NewCmaForm({ creditsBalance }: { creditsBalance: number }) {
  const router = useRouter();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [events, setEvents] = useState<ReportStreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = subject !== null && creditsBalance >= 5 && !running;

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
    setRunning(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subject, unparsedAddress: address }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { reason?: string } | null;
        setError(body?.reason ?? "Couldn't start the report. Try again.");
        setRunning(false);
        return;
      }

      const reportId = response.headers.get("X-Report-Id");
      if (reportId) {
        // Keeps this same component (and its open stream) mounted while
        // making the URL reflect the run, so a refresh lands on
        // /cma/[id]'s own status page instead of back on this form.
        window.history.replaceState(null, "", `/cma/${reportId}`);
      }

      await readSse(response, (data) => {
        setEvents((prev) => [...prev, data as ReportStreamEvent]);
      });

      // Reaching here means the stream closed — either a normal "done"
      // event or a dropped connection. Either way, /cma/[id] is the
      // right place to land: it reads the persisted report directly and
      // falls back to polling if the run is still going.
      if (reportId) {
        router.push(`/cma/${reportId}`);
      } else {
        setRunning(false);
      }
    } catch {
      setError("Lost the connection. Check your network and try again.");
      setRunning(false);
    }
  }

  if (running) {
    return (
      <div className="flex w-full max-w-lg flex-col gap-3">
        <h2 className="text-lg font-semibold text-(--color-foreground)">Working on your CMA…</h2>
        <ul className="flex flex-col gap-1 text-sm text-(--color-muted-foreground)">
          {events.map((event, i) => (
            <li key={i}>{describe(event)}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <p className="text-sm text-(--color-muted-foreground)">
        {creditsBalance} report{creditsBalance === 1 ? "" : "s"} remaining
      </p>

      <AddressAutocomplete onSelect={handleSelect} />

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

      {creditsBalance < 5 && <p className="text-sm text-(--color-destructive)">Not enough credits for a report.</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="min-h-11 cursor-pointer rounded-lg bg-(--color-primary) px-5 py-3 font-semibold text-(--color-on-primary) transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Generate CMA
      </button>
    </div>
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
