// A4: 3 fixed subjects against the real Anthropic API, about $0.50
// total (plan.md Step 7). Runs only via `npm run test:live` — gated by
// vitest.config.mts, and only with the operator's explicit approval.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../helpers/db";
import { property } from "@/lib/db/schema";
import { createSampleDataProvider } from "@/lib/data/sample-provider";
import { runCmaAgent } from "@/lib/agent/loop";
import { runModelTurn } from "@/lib/agent/model-client";
import type { Subject } from "@/lib/engine/adjustments";

const SUBJECTS: Array<{ name: string; subject: Subject }> = [
  {
    name: "Ballard single-family",
    subject: {
      latitude: 47.671,
      longitude: -122.384,
      mlsAreaMajor: "Ballard",
      propertySubType: "SingleFamilyResidence",
      bedroomsTotal: 3,
      bathroomsTotalInteger: 2,
      livingArea: 2100,
      lotSizeSquareFeet: 5200,
      yearBuilt: 1995,
      garageSpaces: 1,
      propertyCondition: "Good",
    },
  },
  {
    name: "Capitol Hill condominium",
    subject: {
      latitude: 47.62,
      longitude: -122.315,
      mlsAreaMajor: "Capitol Hill",
      propertySubType: "Condominium",
      bedroomsTotal: 2,
      bathroomsTotalInteger: 1,
      livingArea: 950,
      lotSizeSquareFeet: null,
      yearBuilt: 2008,
      garageSpaces: 1,
      propertyCondition: "Good",
    },
  },
  {
    name: "Bellevue single-family",
    subject: {
      latitude: 47.615,
      longitude: -122.195,
      mlsAreaMajor: "Bellevue",
      propertySubType: "SingleFamilyResidence",
      bedroomsTotal: 4,
      bathroomsTotalInteger: 3,
      livingArea: 2600,
      lotSizeSquareFeet: 7000,
      yearBuilt: 2005,
      garageSpaces: 2,
      propertyCondition: "Excellent",
    },
  },
];

async function loadFullDataset(testDb: TestDb) {
  const records = JSON.parse(readFileSync("data/seed/properties.json", "utf8"));
  const CHUNK_SIZE = 200;
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    await testDb.db.insert(property).values(records.slice(i, i + CHUNK_SIZE));
  }
}

describe("CMA agent against the real Anthropic API (A4)", () => {
  it.each(SUBJECTS)(
    "completes a real CMA for $name",
    async ({ subject }) => {
      const testDb = await createTestDb();
      try {
        await loadFullDataset(testDb);
        const provider = createSampleDataProvider(testDb.db);

        const generator = runCmaAgent(subject, provider, runModelTurn);
        let next = await generator.next();
        while (!next.done) next = await generator.next();
        const outcome = next.value;

        expect(outcome.status).toBe("succeeded");
        if (outcome.status === "succeeded") {
          expect(outcome.result.selectedComps.length).toBeGreaterThan(0);
          expect(outcome.result.rationale.length).toBeGreaterThan(0);
        }
        console.log(
          `${subject.mlsAreaMajor}: $${outcome.costUsd.toFixed(4)}, ${outcome.usage.outputTokens} output tokens`,
        );
      } finally {
        await testDb.close();
      }
    },
    60_000,
  );
});
