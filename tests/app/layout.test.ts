import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "@/app/layout";
import { NOT_APPRAISAL_DISCLOSURE, SAMPLE_DATA_DISCLOSURE } from "@/lib/disclosures";

describe("RootLayout", () => {
  it("shows both disclosures on every page, regardless of content (A13)", () => {
    const html = renderToStaticMarkup(
      RootLayout({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a plain string stands in for a page's children here
        children: "the-page-content-marker" as any,
        params: Promise.resolve({}),
      }),
    );
    expect(html).toContain(SAMPLE_DATA_DISCLOSURE);
    expect(html).toContain(NOT_APPRAISAL_DISCLOSURE);
    expect(html).toContain("the-page-content-marker");
  });
});
