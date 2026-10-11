// Writes the sample dataset to data/seed/properties.json. Deterministic:
// re-running this produces a byte-identical file (proven by tests/data).
import { writeFileSync } from "node:fs";
import { GENERATED_AS_OF, generateSampleProperties } from "../src/lib/data/generator";

const records = generateSampleProperties();
writeFileSync("data/seed/properties.json", `${JSON.stringify(records, null, 2)}\n`);
console.log(`Wrote ${records.length} records to data/seed/properties.json`);

// A sidecar file, not a field on properties.json itself, so every
// existing reader of that file (scripts/seed.ts, the live test's
// loadFullDataset) keeps working unchanged. The engine itself never
// reads this file — it gets the same value from the exported
// GENERATED_AS_OF constant via DataProvider.getAsOfDate(). This is
// purely for a human looking at the committed data to see what date
// it's anchored to.
writeFileSync(
  "data/seed/metadata.json",
  `${JSON.stringify({ generatedAsOf: GENERATED_AS_OF.toISOString() }, null, 2)}\n`,
);
console.log(`Wrote data/seed/metadata.json (generatedAsOf: ${GENERATED_AS_OF.toISOString()})`);
