// Loads the committed sample dataset into the configured database.
// Idempotent: clears the property table first, so running it twice leaves
// the same data, not duplicates.
import { readFileSync } from "node:fs";
import { property } from "../src/lib/db/schema";
import { propertySchema } from "../src/lib/data/property-schema";
import { getDb } from "../src/lib/db/client";

const CHUNK_SIZE = 200;

async function main() {
  const raw = JSON.parse(readFileSync("data/seed/properties.json", "utf8"));
  const records = raw.map((r: unknown) => propertySchema.parse(r));

  const db = getDb();
  await db.delete(property);
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    await db.insert(property).values(records.slice(i, i + CHUNK_SIZE));
  }
  console.log(`Seeded ${records.length} properties.`);
}

main();
