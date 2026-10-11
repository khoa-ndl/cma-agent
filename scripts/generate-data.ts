// Writes the sample dataset to data/seed/properties.json. Deterministic:
// re-running this produces a byte-identical file (proven by tests/data).
import { writeFileSync } from "node:fs";
import { generateSampleProperties } from "../src/lib/data/generator";

const records = generateSampleProperties();
writeFileSync("data/seed/properties.json", `${JSON.stringify(records, null, 2)}\n`);
console.log(`Wrote ${records.length} records to data/seed/properties.json`);
