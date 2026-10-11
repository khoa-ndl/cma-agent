// The only file that imports a database driver (spec 2.1, portability rule
// 2). Swapping the database host is a change to DATABASE_URL and, at most,
// this file; schema.ts and every caller stay the same.
//
// Uses Neon's HTTP driver: one request per query, no connection pool to
// manage between serverless invocations (spec 7, "designed for short-lived
// serverless functions"). It has no real multi-statement transactions, which
// is why Step 6's credit reservation is one atomic SQL statement instead.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

// Generic over the driver's query-result type, not tied to Neon's — a
// PGlite instance in tests, and any other Postgres driver, structurally
// satisfy this too (portability rule 2). A function that takes a plain
// `Database` can only run against Neon; one generic over PgQueryResultHKT
// runs against whatever Postgres driver its caller passes in.
export type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> = PgDatabase<
  TQueryResult,
  typeof schema
>;

let db: Database | undefined;

/**
 * Creates the connection on first use rather than at import time, so
 * importing this module (e.g. during `next build`, before DATABASE_URL is
 * set) never fails. Tests never call this — they use tests/helpers/db.ts.
 */
export function getDb(): Database {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env and fill in a connection string.",
      );
    }
    db = drizzle(neon(connectionString), { schema });
  }
  return db;
}
