import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// .env.example is the contract for configuration: every variable the app
// reads must be listed there (names only, no real values).
const REQUIRED = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "DATABASE_URL", "SESSION_SECRET"];

describe(".env.example", () => {
  const names = readFileSync(".env.example", "utf8")
    .split("\n")
    .map((line) => line.split("=")[0].trim())
    .filter((name) => name && !name.startsWith("#"));

  it.each(REQUIRED)("lists %s", (name) => {
    expect(names).toContain(name);
  });
});
