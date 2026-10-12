import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "../../../helpers/db";
import { accessCodes, creditLedger, property, reports } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { FIXTURE_PROPERTIES } from "../../../fixtures/properties";
import { neverFinishes, scripted, toolTurn } from "../../../helpers/fake-model";
import { handleCreateOperatorReport, type AdminReportStreamEvent } from "@/app/api/admin/reports/logic";
import type { Subject } from "@/lib/engine/adjustments";
import type { AgentRunOutcome } from "@/lib/agent/loop";

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

const CUSTOMER_CODE_ID = "11111111-1111-1111-1111-111111111111";

async function drain(events: AsyncGenerator<AdminReportStreamEvent, void>): Promise<AdminReportStreamEvent[]> {
  const out: AdminReportStreamEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

function succeedingModel() {
  return scripted([
    toolTurn("search_comps", { radiusMiles: 10, monthsBack: 12, sizeBandPercent: 50, statuses: ["Closed"] }),
    toolTurn("compute_adjustments", { listingKeys: ["FX-001", "FX-002"] }),
    toolTurn("submit_cma", {
      selectedComps: [
        { listingKey: "FX-001", weight: 1 },
        { listingKey: "FX-002", weight: 2 },
      ],
      excludedComps: [],
      rationale: "test",
    }),
  ]);
}

describe("handleCreateOperatorReport", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(property).values(FIXTURE_PROPERTIES);
    await testDb.db.insert(accessCodes).values({
      id: CUSTOMER_CODE_ID,
      codeHash: "irrelevant-for-this-test",
      label: "Customer",
      creditsBalance: 45,
    });
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects a non-admin request", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateOperatorReport(testDb.db, provider, succeedingModel(), SUBJECT, false);
    expect(result).toEqual({ kind: "error", status: 401, body: { reason: "unauthenticated" } });
  });

  it("rejects an invalid subject", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateOperatorReport(
      testDb.db,
      provider,
      succeedingModel(),
      { ...SUBJECT, bedroomsTotal: -1 },
      true,
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.status).toBe(400);
  });

  it("streams tool events in order, then a done event, and persists the result, with no balance impact (D6)", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateOperatorReport(testDb.db, provider, succeedingModel(), SUBJECT, true);
    expect(result.kind).toBe("stream");
    if (result.kind !== "stream") throw new Error("expected a stream");

    const events = await drain(result.events);
    expect(events.map((e) => e.type)).toEqual([
      "tool_call",
      "tool_result",
      "tool_call",
      "tool_result",
      "tool_call",
      "tool_result",
      "done",
    ]);
    const done = events.at(-1) as { type: "done"; outcome: AgentRunOutcome };
    expect(done.outcome.status).toBe("succeeded");

    const [row] = await testDb.db.select().from(reports).where(eq(reports.id, result.reportId));
    expect(row.status).toBe("succeeded");
    expect(row.result).not.toBeNull();
    expect(row.outputTokens).toBeGreaterThan(0);

    const [customer] = await testDb.db.select().from(accessCodes).where(eq(accessCodes.id, CUSTOMER_CODE_ID));
    expect(customer.creditsBalance).toBe(45); // untouched by an operator report

    const ledgerRows = await testDb.db.select().from(creditLedger);
    expect(ledgerRows).toHaveLength(0); // no ledger entry for an unmetered run
  });

  it("marks the report failed, with no refund attempt, when the agent hits the turn limit", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateOperatorReport(testDb.db, provider, neverFinishes(), SUBJECT, true);
    if (result.kind !== "stream") throw new Error("expected a stream");

    const events = await drain(result.events);
    const done = events.at(-1) as { type: "done"; outcome: AgentRunOutcome };
    expect(done.outcome.status).toBe("failed");

    const [row] = await testDb.db.select().from(reports).where(eq(reports.id, result.reportId));
    expect(row.status).toBe("failed");
    expect(row.finishedAt).not.toBeNull();
  });

  it("rejects a second concurrent operator report while one is already running", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const first = await handleCreateOperatorReport(testDb.db, provider, neverFinishes(), SUBJECT, true);
    if (first.kind !== "stream") throw new Error("expected a stream");

    const second = await handleCreateOperatorReport(testDb.db, provider, succeedingModel(), SUBJECT, true);
    expect(second).toEqual({ kind: "error", status: 409, body: { reason: "already_running" } });

    await first.events.return(undefined);
  });

  // Found live in production: an unexpected error partway through the
  // stream used to skip the report's DB update entirely -- it stayed
  // "running" forever (confirmed in the real Reports & costs screen)
  // and blocked every subsequent operator report with "already_running"
  // until the 5-minute stale sweep eventually caught it.
  it("still marks the report failed when the model throws an unexpected error", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const throwingModel = async () => {
      throw new Error("simulated network failure");
    };
    const result = await handleCreateOperatorReport(testDb.db, provider, throwingModel, SUBJECT, true);
    if (result.kind !== "stream") throw new Error("expected a stream");

    const events = await drain(result.events);
    const done = events.at(-1) as { type: "done"; outcome: AgentRunOutcome };
    expect(done.outcome.status).toBe("failed");
    if (done.outcome.status === "failed") {
      expect(done.outcome.failureReason).toBe("unexpected_error");
    }

    const [row] = await testDb.db.select().from(reports).where(eq(reports.id, result.reportId));
    expect(row.status).toBe("failed");
    expect(row.finishedAt).not.toBeNull();
  });
});
