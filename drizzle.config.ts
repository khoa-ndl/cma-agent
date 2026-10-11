import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs schema.ts against migrations on disk —
// it needs no real connection, so a placeholder URL is fine for that command.
// `drizzle-kit migrate` (Step 11) needs a real DATABASE_URL in .env.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://placeholder/placeholder",
  },
});
