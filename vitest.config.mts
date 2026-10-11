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
  },
});
