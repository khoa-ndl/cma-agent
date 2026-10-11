import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "../../helpers/db";
import { accessCodes, property, reports } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { FIXTURE_PROPERTIES } from "../../fixtures/properties";
import { neverFinishes, scripted, toolTurn } from "../../helpers/fake-model";
import { handleCreateReport, type ReportStreamEvent } from "@/app/api/reports/logic";
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

const CODE_ID = "11111111-1111-1111-1111-111111111111";

async function drain(events: AsyncGenerator<ReportStreamEvent, void>): Promise<ReportStreamEvent[]> {
  const out: ReportStreamEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

const SUCCEEDING_MODEL = scripted([
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

describe("handleCreateReport", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    await testDb.db.insert(property).values(FIXTURE_PROPERTIES);
    await testDb.db.insert(accessCodes).values({ id: CODE_ID, codeHash: "irrelevant-for-this-test", label: "ok", creditsBalance: 45 });
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("rejects an unauthenticated request without touching credits", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateReport(testDb.db, provider, SUCCEEDING_MODEL, SUBJECT, null);
    expect(result).toEqual({ kind: "error", status: 401, body: { reason: "unauthenticated" } });

    const [code] = await testDb.db.select().from(accessCodes).where(eq(accessCodes.id, CODE_ID));
    expect(code.creditsBalance).toBe(45);
  });

  it("rejects an invalid subject", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateReport(testDb.db, provider, SUCCEEDING_MODEL, { ...SUBJECT, bedroomsTotal: -1 }, CODE_ID);
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.status).toBe(400);
  });

  it("rejects when the code has too few credits", async () => {
    await testDb.db.update(accessCodes).set({ creditsBalance: 4 }).where(eq(accessCodes.id, CODE_ID));
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateReport(testDb.db, provider, SUCCEEDING_MODEL, SUBJECT, CODE_ID);
    expect(result).toEqual({ kind: "error", status: 402, body: { reason: "insufficient_credits" } });
  });

  it("streams tool events in order, then a done event, and persists the result (A5, A14)", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateReport(testDb.db, provider, SUCCEEDING_MODEL, SUBJECT, CODE_ID);
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
    expect(row.finishedAt).not.toBeNull();

    const [code] = await testDb.db.select().from(accessCodes).where(eq(accessCodes.id, CODE_ID));
    expect(code.creditsBalance).toBe(40); // reserved, never refunded on success
  });

  it("refunds credits and marks the report failed when the agent hits the turn limit (A8, A11)", async () => {
    const provider = createSampleDataProvider(testDb.db);
    const result = await handleCreateReport(testDb.db, provider, neverFinishes(), SUBJECT, CODE_ID);
    if (result.kind !== "stream") throw new Error("expected a stream");

    const events = await drain(result.events);
    const done = events.at(-1) as { type: "done"; outcome: AgentRunOutcome };
    expect(done.outcome.status).toBe("failed");

    const [row] = await testDb.db.select().from(reports).where(eq(reports.id, result.reportId));
    expect(row.status).toBe("failed");

    const [code] = await testDb.db.select().from(accessCodes).where(eq(accessCodes.id, CODE_ID));
    expect(code.creditsBalance).toBe(45); // refunded back to the starting balance
  });
});
