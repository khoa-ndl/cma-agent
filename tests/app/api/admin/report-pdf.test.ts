import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDocumentProxy, extractText } from "unpdf";
import { createTestDb, type TestDb } from "../../../helpers/db";
import { accessCodes, reports } from "@/lib/db/schema";
import { renderAdminReportPdf } from "@/app/api/admin/reports/[id]/pdf/logic";
import type { CmaResult } from "@/lib/agent/tools";
import type { Subject } from "@/lib/engine/adjustments";

const CODE_A = "11111111-1111-1111-1111-111111111111";

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
      weight: 1,
      basePrice: 950000,
      adjustments: [{ factor: "livingArea", amount: 3500 }],
      totalAdjustment: 3500,
      adjustedValue: 953500,
    },
  ],
  excludedComps: [],
  rationale: "Only one close, well-matched comp was available in range.",
  valueRange: { low: 953500, high: 953500, suggestedListPrice: 953500 },
};

describe("renderAdminReportPdf", () => {
  let testDb: TestDb;
  let runningReportId: string;
  let succeededReportId: string;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(accessCodes).values({ id: CODE_A, codeHash: "a", label: "a", creditsBalance: 40 });
    const [running] = await testDb.db
      .insert(reports)
      .values({ accessCodeId: CODE_A, status: "running", subject: SUBJECT })
      .returning();
    runningReportId = running.id;
    const [succeeded] = await testDb.db
      .insert(reports)
      .values({ accessCodeId: CODE_A, status: "succeeded", subject: SUBJECT, result: RESULT })
      .returning();
    succeededReportId = succeeded.id;
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const result = await renderAdminReportPdf(testDb.db, succeededReportId, false);
    expect(result).toEqual({ kind: "error", status: 401, body: { reason: "unauthenticated" } });
  });

  it("refuses to render a report that hasn't succeeded yet", async () => {
    const result = await renderAdminReportPdf(testDb.db, runningReportId, true);
    expect(result).toEqual({ kind: "error", status: 409, body: { reason: "not_ready" } });
  });

  it("renders any succeeded report's real PDF, regardless of which code owns it", async () => {
    const result = await renderAdminReportPdf(testDb.db, succeededReportId, true);
    expect(result.kind).toBe("pdf");
    if (result.kind !== "pdf") throw new Error("expected a pdf");

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    const pdf = await getDocumentProxy(new Uint8Array(result.buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    expect(text).toContain("4200 Ballard Ave NW");
  });
});
