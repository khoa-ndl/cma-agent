import { describe, expect, it } from "vitest";
import { clientIp } from "@/app/api/_lib/request";

describe("clientIp", () => {
  it("takes the first address from a comma-separated x-forwarded-for header", () => {
    expect(clientIp("203.0.113.5, 70.41.3.18, 150.172.238.178")).toBe("203.0.113.5");
  });

  it("trims whitespace around the first address", () => {
    expect(clientIp("  203.0.113.5  , 70.41.3.18")).toBe("203.0.113.5");
  });

  it("falls back to 'unknown' when the header is missing", () => {
    expect(clientIp(null)).toBe("unknown");
  });

  it("falls back to 'unknown' when the header is empty", () => {
    expect(clientIp("")).toBe("unknown");
  });
});
