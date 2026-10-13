"use client";

import { useEffect, useState } from "react";
import type { Subject } from "@/lib/engine/adjustments";
import type { ReportBody } from "@/app/api/reports/[id]/logic";
import { ADJUSTMENT_FACTORS, compactCurrency, currency, layoutCompMap, photoForListing } from "@/lib/report-formatting";

export type { ReportBody };

const POLL_MS = 2500;

// Hand-drawn teardrop map pin (no icon library -- Global Constraints).
// Path is authored tip-first at the local origin so the group's
// translate(x, y) lands the pin's point exactly on the mapped
// coordinate, matching standard map-pin convention.
function CompMapPin({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  const scale = size / 24;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 0C0 0 -9 -9.5 -9 -15a9 9 0 1 1 18 0c0 5.5-9 15-9 15Z" fill={fill} />
      <circle cx={0} cy={-15} r={3} fill="var(--color-card)" />
    </g>
  );
}

export function ReportView({
  reportId,
  initial,
  apiBasePath = "/api/reports",
  unmetered = false,
  mapPositions,
}: {
  reportId: string;
  initial: ReportBody;
  apiBasePath?: string;
  unmetered?: boolean;
  mapPositions?: ReportBody["mapPositions"];
}) {
  const [report, setReport] = useState(initial);

  useEffect(() => {
    if (report.status !== "running") return;
    const interval = setInterval(async () => {
      const response = await fetch(`${apiBasePath}/${reportId}`);
      if (!response.ok) return;
      setReport((await response.json()) as ReportBody);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [report.status, reportId, apiBasePath]);

  if (report.status === "running") {
    return <p className="text-(--color-muted-foreground)">Still working on this report…</p>;
  }

  if (report.status === "failed") {
    return (
      <div className="flex max-w-md flex-col gap-2 text-center">
        <h1 className="text-xl font-semibold text-(--color-foreground)">This report didn&apos;t complete</h1>
        <p className="text-(--color-muted-foreground)">
          {unmetered
            ? "Something went wrong partway through. You can start a new report."
            : "Something went wrong partway through. Your credits were refunded — you can start a new report."}
        </p>
      </div>
    );
  }

  const result = report.result;
  if (!result) {
    return <p className="text-(--color-destructive)">This report has no result on record.</p>;
  }

  // unparsedAddress lives on the stored subject JSON blob, not the
  // Subject TS interface itself (set only when address autocomplete
  // supplied one) -- same cast pattern the reports list pages use for
  // the same fallback-to-area reasoning.
  const subject = report.subject as Subject & { unparsedAddress?: string };

  // mapPositions.subject can be null (no sourceListingKey, or the lookup
  // came back empty) -- fall back to the subject's own lat/long, which
  // the Subject type always carries.
  const compMapLayout = mapPositions
    ? layoutCompMap(mapPositions.subject ?? subject, mapPositions.comps)
    : null;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8">
      <section>
        <h1 className="text-xl font-semibold text-(--color-foreground)">Comparative market analysis</h1>
      </section>

      <section className="rounded-lg border-2 border-(--color-primary) bg-(--color-primary)/5 p-6">
        <p className="mb-1 text-xs font-semibold tracking-wide text-(--color-primary) uppercase">Subject property</p>
        <h2 className="font-heading text-xl font-bold text-(--color-foreground)">
          {subject.unparsedAddress ?? subject.mlsAreaMajor}
        </h2>
        <p className="mt-1 text-sm text-(--color-muted-foreground)">
          {subject.mlsAreaMajor} · {subject.propertySubType} · {subject.bedroomsTotal} bed /{" "}
          {subject.bathroomsTotalInteger} bath · {subject.livingArea.toLocaleString()} sq ft
        </p>
      </section>

      {compMapLayout && (
        <section className="rounded-lg border border-(--color-border) bg-(--color-card) p-6">
          <h2 className="mb-3 text-lg font-semibold text-(--color-foreground)">Comp map</h2>
          <svg
            viewBox={`0 0 ${compMapLayout.viewBoxSize} ${compMapLayout.viewBoxSize}`}
            className="mx-auto h-80 w-80"
            role="img"
            aria-label="Map of the subject property and comparable sales by relative location"
          >
            <rect
              x={0}
              y={0}
              width={compMapLayout.viewBoxSize}
              height={compMapLayout.viewBoxSize}
              rx={8}
              fill="var(--color-muted)"
            />
            {compMapLayout.pins.map((pin) => {
              const comp = result.selectedComps.find((c) => c.listingKey === pin.listingKey);
              return (
                <g key={pin.listingKey}>
                  <CompMapPin x={pin.x} y={pin.y} size={16} fill="var(--color-accent)" />
                  {comp && (
                    <text x={pin.x} y={pin.y + 13} textAnchor="middle" fontSize={8} fill="var(--color-foreground)">
                      {compactCurrency(comp.adjustedValue)}
                    </text>
                  )}
                </g>
              );
            })}
            <CompMapPin x={compMapLayout.subject.x} y={compMapLayout.subject.y} size={24} fill="var(--color-primary)" />
          </svg>
          <p className="mt-2 text-center text-xs text-(--color-muted-foreground)">
            Subject property (navy) and comparable sales (orange) by approximate location
          </p>
        </section>
      )}

      <section className="rounded-lg border border-(--color-border) bg-(--color-card) p-6">
        <h2 className="mb-2 text-lg font-semibold text-(--color-foreground)">Value range</h2>
        <p className="text-2xl font-semibold text-(--color-primary)">
          {currency(result.valueRange.low)} – {currency(result.valueRange.high)}
        </p>
        <p className="text-sm text-(--color-muted-foreground)">
          Suggested list price: {currency(result.valueRange.suggestedListPrice)}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-(--color-foreground)">Comparable sales</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-(--color-muted-foreground)">
              <tr>
                <th className="py-2 pr-4">Photo</th>
                <th className="py-2 pr-4">Address</th>
                <th className="py-2 pr-4">Weight</th>
                <th className="py-2 pr-4">Base price</th>
                <th className="py-2 pr-4">Adjustment</th>
                <th className="py-2 pr-4">Adjusted value</th>
              </tr>
            </thead>
            <tbody>
              {result.selectedComps.map((comp) => (
                <tr key={comp.listingKey} className="border-t border-(--color-border)">
                  <td className="py-2 pr-4">
                    <img
                      src={photoForListing(comp.listingKey, subject.propertySubType)}
                      alt={`${comp.unparsedAddress} (representative photo)`}
                      width={80}
                      height={64}
                      className="h-16 w-20 rounded-md object-cover"
                    />
                    <p className="mt-1 text-xs text-(--color-muted-foreground)">Representative image</p>
                  </td>
                  <td className="py-2 pr-4">{comp.unparsedAddress}</td>
                  <td className="py-2 pr-4">{comp.weight}</td>
                  <td className="py-2 pr-4">{currency(comp.basePrice)}</td>
                  <td className="py-2 pr-4">{currency(comp.totalAdjustment)}</td>
                  <td className="py-2 pr-4 font-medium">{currency(comp.adjustedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-(--color-foreground)">Adjustment grid</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-(--color-muted-foreground)">
              <tr>
                <th className="py-2 pr-4 whitespace-nowrap">Address</th>
                <th className="py-2 pr-4 whitespace-nowrap">Total</th>
                {ADJUSTMENT_FACTORS.map(([factor, label]) => (
                  <th key={factor} className="py-2 pr-4 whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.selectedComps.map((comp) => {
                const byFactor = Object.fromEntries(comp.adjustments.map((item) => [item.factor, item.amount]));
                return (
                  <tr key={comp.listingKey} className="border-t border-(--color-border)">
                    <td className="py-2 pr-4 whitespace-nowrap">{comp.unparsedAddress}</td>
                    <td className="py-2 pr-4 font-medium whitespace-nowrap">{currency(comp.totalAdjustment)}</td>
                    {ADJUSTMENT_FACTORS.map(([factor]) => {
                      const amount = byFactor[factor] ?? 0;
                      return (
                        <td
                          key={factor}
                          className={amount === 0 ? "py-2 pr-4 text-(--color-muted-foreground)" : "py-2 pr-4"}
                        >
                          {amount === 0 ? "—" : currency(amount)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {result.excludedComps.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-(--color-foreground)">Excluded comps</h2>
          <ul className="text-sm text-(--color-muted-foreground)">
            {result.excludedComps.map((comp) => (
              <li key={comp.listingKey}>
                {comp.listingKey}: {comp.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-(--color-foreground)">Rationale</h2>
        <p className="text-sm text-(--color-foreground)">{result.rationale}</p>
      </section>

      <a
        href={`${apiBasePath}/${reportId}/pdf`}
        className="min-h-11 w-fit cursor-pointer rounded-lg border border-(--color-border) px-5 py-3 font-semibold text-(--color-foreground) transition-opacity duration-200 hover:opacity-80"
      >
        Download PDF
      </a>
    </div>
  );
}
