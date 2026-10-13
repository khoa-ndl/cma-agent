import { defineConfig } from "vitest/config";

// Live tests call the paid Anthropic API, so they only run via `npm run test:live`.
const live = process.env.LIVE === "1";

export default defineConfig({
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: live ? ["tests/live/**/*.test.ts"] : ["tests/**/*.test.ts"],
    exclude: live ? [] : ["tests/live/**"],
    // Each test file boots its own in-memory PGlite (WASM Postgres). Running
    // all ~40 files' worth concurrently can starve `beforeEach`'s
    // createTestDb() past its 10s hook timeout under real machine load --
    // confirmed by rerunning the exact same suite with file parallelism
    // disabled (229/229 passed) right after a parallel run threw timeouts.
    // Capping concurrency instead of disabling it outright keeps most of
    // the speedup while not needing every PGlite instance alive at once.
    maxWorkers: 4,
  },
});
