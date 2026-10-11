// Fresh, in-memory Postgres per test via PGlite — real Postgres, no install,
// no Docker (plan.md Step 2). Tests never import src/lib/db/client.ts (the
// Neon swap point); application code takes a Database as a parameter so
// tests can pass this instance straight in.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/lib/db/migrations" });
  // Each test's db must be closed when done, or its in-memory instance
  // leaks for the life of the test worker — this helper is reused by
  // nearly every later step's tests.
  return { db, close: () => client.close() };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
