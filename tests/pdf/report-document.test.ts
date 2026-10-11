import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocumentProxy, extractText } from "unpdf";
import { ReportDocument } from "@/lib/pdf/report-document";
import type { Subject } from "@/lib/engine/adjustments";
import type { CmaResult } from "@/lib/agent/tools";
import { getAdjustmentRates } from "@/lib/engine/config";
import { SAMPLE_DATA_DISCLOSURE, NOT_APPRAISAL_DISCLOSURE } from "@/lib/disclosures";

const SUBJECT: Subject = {
  latitude: 47.67,
  longitude: -122.38,
  mlsAreaMajor: "Ballard",
  propertySubType: "SingleFamilyResidence",
  bedroomsTotal: 3,
  bathroomsTotalInteger: 2,
  livingArea: 2000,
  lotSizeSquareFeet: 5000,
  yearBuilt: 2000,
  garageSpaces: 1,
  propertyCondition: "Good",
};

const RESULT: CmaResult = {
  selectedComps: [
    {
      listingKey: "WA-000001",
      unparsedAddress: "4200 Ballard Ave NW",
      weight: 0.6,
      basePrice: 950000,
      adjustments: [
        { factor: "livingArea", amount: 3500 },
        { factor: "bedrooms", amount: 0 },
        { factor: "bathrooms", amount: 0 },
        { factor: "garageSpaces", amount: 0 },
        { factor: "lotSize", amount: 0 },
        { factor: "age", amount: -1000 },
        { factor: "condition", amount: 0 },
        { factor: "marketTime", amount: 2850 },
      ],
      totalAdjustment: 5350,
      adjustedValue: 955350,
    },
    {
      listingKey: "WA-000002",
      unparsedAddress: "1500 NW 65th St",
      weight: 0.4,
      basePrice: 900000,
      adjustments: [
        { factor: "livingArea", amount: -1750 },
        { factor: "bedrooms", amount: 0 },
        { factor: "bathrooms", amount: 12000 },
        { factor: "garageSpaces", amount: 0 },
        { factor: "lotSize", amount: 0 },
        { factor: "age", amount: 0 },
        { factor: "condition", amount: 0 },
        { factor: "marketTime", amount: 2700 },
      ],
      totalAdjustment: 12950,
      adjustedValue: 912950,
    },
  ],
  excludedComps: [{ listingKey: "WA-000099", reason: "Lot size well outside the subject's band." }],
  rationale: "The two supporting comps sit within a half mile and closed within the last two months.",
  valueRange: { low: 912950, high: 955350, suggestedListPrice: 938390 },
};

describe("ReportDocument", () => {
  it("includes every required section, with disclosures on every page (A7, A13)", async () => {
    const buffer = await renderToBuffer(ReportDocument({ subject: SUBJECT, result: RESULT }));
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text: pages } = await extractText(pdf, { mergePages: false });

    // Multiple pages: a dedicated cover, then content.
    expect(totalPages).toBeGreaterThanOrEqual(2);

    // Disclosures on every single page (A13).
    for (const pageText of pages) {
      expect(pageText).toContain(SAMPLE_DATA_DISCLOSURE);
      expect(pageText).toContain(NOT_APPRAISAL_DISCLOSURE);
    }

    const fullText = pages.join("\n");

    // Cover + subject.
    expect(fullText).toContain("Ballard");
    expect(fullText).toContain("SingleFamilyResidence");

    // Comps table.
    expect(fullText).toContain("4200 Ballard Ave NW");
    expect(fullText).toContain("1500 NW 65th St");

    // Adjustment grid: comp-level dollar figures.
    expect(fullText).toContain("5,350");
    expect(fullText).toContain("12,950");

    // Pricing recommendation.
    expect(fullText).toContain("912,950");
    expect(fullText).toContain("955,350");
    expect(fullText).toContain("938,390");

    // Rationale.
    expect(fullText).toContain("The two supporting comps sit within a half mile");

    // Excluded comps.
    expect(fullText).toContain("Lot size well outside the subject's band.");

    // Methodology appendix: the actual area adjustment rates, not just the
    // per-comp grid — spec 4.2's "documented adjustment table."
    const rates = getAdjustmentRates("Ballard");
    expect(fullText).toContain(`$${rates.livingAreaPerSqft.toLocaleString()} / sq ft`);
    expect(fullText).toContain(`$${rates.bedroom.toLocaleString()}`);
  });
});
