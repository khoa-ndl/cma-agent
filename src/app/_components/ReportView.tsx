"use client";

import { useEffect, useState } from "react";
import type { Subject } from "@/lib/engine/adjustments";
import type { ReportBody } from "@/app/api/reports/[id]/logic";
import { ADJUSTMENT_FACTORS, currency } from "@/lib/report-formatting";

export type { ReportBody };

const POLL_MS = 2500;

export function ReportView({
  reportId,
  initial,
  apiBasePath = "/api/reports",
}: {
  reportId: string;
  initial: ReportBody;
  apiBasePath?: string;
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
          Something went wrong partway through. Your credits were refunded — you can start a new report.
        </p>
      </div>
    );
  }

  const result = report.result;
  if (!result) {
    return <p className="text-(--color-destructive)">This report has no result on record.</p>;
  }

  const subject = report.subject as Subject;

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8">
      <section>
        <h1 className="text-xl font-semibold text-(--color-foreground)">Comparative market analysis</h1>
        <p className="text-sm text-(--color-muted-foreground)">
          {subject.mlsAreaMajor} · {subject.propertySubType} · {subject.bedroomsTotal} bed /{" "}
          {subject.bathroomsTotalInteger} bath · {subject.livingArea.toLocaleString()} sq ft
        </p>
      </section>

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
