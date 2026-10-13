# UI/UX Redesign Implementation Plan

**Status:** All 8 tasks implemented and committed on `worktree-ui-ux-redesign` (branch `worktree-ui-ux-redesign`, 11 commits ahead of `main`). `npm test` passes (258/258, typecheck and lint clean). Manual verification done 2026-10-13: Playwright walkthrough of `/`, admin login, `/admin` (Task 7 KPI cards), `/admin/reports`, `/admin/reports/[id]` (subject card, comp map, photo-forward comp rows), `/admin/codes` — zero console/page errors; downloaded a real PDF through `/api/admin/reports/[id]/pdf` and confirmed all 5 pages (cover with Outfit type, subject section, comp map, photo captions, adjustment grid, rationale, excluded comps, methodology appendix, disclosures on every page). The end-user-only chrome (`/cma/new`, `/cma/reports`, `/cma/[id]`) wasn't separately re-verified — no access code was on hand for this pass — but it shares `ReportView.tsx` and the same design tokens with what was checked. Code review (Step 13-equivalent: `/code-review`, `/ponytail-review`) and the merge decision are still open.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give CMA Agent an enterprise-residential-real-estate visual language (researched from Cloud CMA, RPR, BoldTrail, Compass, Cotality) instead of a generic SaaS template, applied consistently across the PDF report, the web results page, and the admin dashboard — and make the subject property unmistakably prominent everywhere it appears.

**Architecture:** Refines the existing design system in place (`design-system/cma-agent/MASTER.md`) rather than replacing it. The headline addition is a comp map drawn as plain SVG — subject centered, comps as pins — built from a new pure geometry function shared by two thin renderers (one for the browser, one for `@react-pdf/renderer`, since react-pdf has its own `<Svg>`/`<Circle>`/`<Text>` primitives and can't literally reuse DOM/JSX). A new pure photo-assignment function deterministically maps each comp to one of ~15-20 bundled, properly-licensed stock photos. No new runtime dependencies.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (CSS custom properties via `@theme inline`), `@react-pdf/renderer`, Vitest + PGlite (existing test stack, unchanged).

**Spec:** [docs/superpowers/specs/2026-10-13-ui-ux-redesign-design.md](../specs/2026-10-13-ui-ux-redesign-design.md)

## Global Constraints

- No new runtime dependencies (design doc Constraints) — the comp map is hand-drawn SVG, not a mapping library; map-pin icons are hand-drawn inline SVG, not an icon package (matches this codebase's existing precedent: `NewCmaForm.tsx`'s close/warning icons are inline SVG, no `lucide-react`/`@phosphor-icons` added).
- Accessibility bar carries over unchanged: 4.5:1 contrast minimum, visible focus states, `prefers-reduced-motion` respected, no emoji icons (design doc Constraints; existing `MASTER.md` checklist).
- The chosen display typeface (Outfit) must be a **bundled local font file** for `@react-pdf/renderer` registration, not a Google-Fonts-only link (design doc Constraints — react-pdf can't use a browser `<link>` tag).
- Every figure on the results page and PDF still comes only from `CmaResult`/engine output, never restated by the model (spec 4.1, A5) — this redesign changes presentation only, never what numbers get shown or where they come from.
- Disclosures (`SAMPLE_DATA_DISCLOSURE`, `NOT_APPRAISAL_DISCLOSURE`) still appear on every screen and PDF page unchanged (spec A13) — the new "Representative image" photo caption is additional, not a replacement.
- `npm test` (typecheck, lint, vitest) must pass before every commit, per this project's established CLAUDE.md rule.

## Review Focus

1. **A comp with lat/long identical or near-identical to the subject** (e.g. the subject's own area has a very tight cluster) — pins must not fully overlap illegibly; the map should still render something sane, not divide-by-zero or produce `NaN` coordinates.
2. **Zero or one selected comp** — `submitCmaInputSchema` allows as few as 1 selected comp (`.min(1)`); the map's radius/scale math must not divide by zero when there's no "farthest comp" spread to measure against.
3. **A report whose comps include properties outside the subject's own area** (nothing in the engine prevents this) — the map's scale must still fit every selected comp on-canvas, not just typically-nearby ones.
4. **An old report, created before this redesign shipped** — must still render (the design resolved this: coordinates are looked up live by `listingKey`, not read from stored jsonb, so no stored-shape migration is needed; but the plan's own tests must prove this, since a PGlite-seeded property row is exactly what an "old report" looks like to this code).
5. **A `sourceListingKey` that no longer exists in `property`** (deleted/reseeded dataset) — the subject's own position on the map must degrade gracefully (omit the subject pin, or fall back to the `Subject.latitude`/`longitude` already on hand) rather than throwing and breaking the whole report render.

---

## Task 1: Design tokens — typography and color refresh

**Files:**
- Modify: `design-system/cma-agent/MASTER.md`
- Modify: `src/app/globals.css`
- Create: `public/fonts/Outfit-Bold.ttf`, `public/fonts/Outfit-ExtraBold.ttf` (downloaded static cuts, for PDF registration)
- Test: none (pure visual tokens — matches this codebase's existing precedent that visual-only changes are verified by browser check, not unit tests; see `CLAUDE.md`)

**Interfaces:**
- Produces: `--color-primary: #1E3A5F` (was `#2563eb`), `--color-secondary` adjusted to an analogous navy-blue, `--color-ring` matching primary, `--color-border`/`--color-muted` cooled slightly toward the new primary's hue. `--color-accent` (`#EA580C`) and `--color-destructive` (`#DC2626`) stay unchanged — both are already accessibility-tested and used throughout the built app; changing them would force re-verifying every existing component's contrast for no benefit the research calls for. A new `--font-heading: "Outfit", ui-sans-serif, system-ui, sans-serif` CSS variable (alongside the existing `--font-sans` for Plus Jakarta Sans, which stays the body font), exposed as a `font-heading` Tailwind utility via `@theme inline` — later tasks apply `className="font-heading"` to every `<h1>`/`<h2>` they touch.

- [x] **Step 1: Regenerate `design-system/cma-agent/MASTER.md` via `ui-ux-pro-max`**

Run the skill's search script with `--persist --force --output-dir` pointed at the repo root (force is authorized here — this plan is the explicit authorization the skill's own docs require, and the file is about to be hand-edited in the next step anyway): pin **Primary `#1E3A5F`** (deep institutional navy, closer to RPR's credible register than the current bright blue — see design doc research), keep **Accent `#EA580C`** and all other existing values the baseline search doesn't need to touch, and **Heading: Outfit / Body: Plus Jakarta Sans** (Outfit is a confident geometric sans matching the bold headline treatment every researched reference uses — Compass, BoldTrail, Cotality; Plus Jakarta Sans stays as-is for body to minimize diff and because the two pair cleanly, both being geometric sans). Keep the existing Minimalism/Swiss style, spacing scale, shadow scale, and dials (Variance 3, Motion 3, Density 7) — this is a refinement, not a new generation from scratch.

- [x] **Step 2: Hand-correct the generated `MASTER.md` to the exact pinned values above if the tool's output drifts**

The search tool returns the closest database match, not an exact custom blend — confirm `Primary`/`Accent`/typography rows match the values this step specifies exactly, editing the file directly if not.

- [x] **Step 3: Download Outfit's Bold (700) and ExtraBold (800) static `.ttf` files from Google Fonts into `public/fonts/`**

These two weights are what headline treatments need (matching the existing `Plus Jakarta Sans` weight scale's own use of 700/800 for titles). Regular/Medium weights aren't needed since Outfit is headline-only here.

- [x] **Step 4: Update `src/app/globals.css`**

Add Outfit's Google Fonts `@import` (for the web — browsers can use the CDN link even though the PDF can't) alongside the existing Plus Jakarta Sans one. Update the `:root` color block to the Step 1/2 values. Add `--font-heading: "Outfit", ui-sans-serif, system-ui, sans-serif;` to the existing `@theme inline` block next to `--font-sans`.

- [x] **Step 5: `npm run build` to confirm nothing broke**

Run: `npm run build`
Expected: succeeds, no CSS/type errors.

- [x] **Step 6: Commit**

```bash
git add design-system/cma-agent/MASTER.md src/app/globals.css public/fonts/
git commit -m "Refresh design tokens: institutional navy + Outfit display type"
```

---

## Task 2: Comp-map geometry (pure, shared logic)

**Files:**
- Modify: `src/lib/report-formatting.ts`
- Test: `tests/report-formatting.test.ts` (new file)

**Interfaces:**
- Consumes: `distanceMiles` and `LatLng` from `@/lib/engine/geo` (existing, unchanged).
- Produces (for Tasks 3 and 4 to render):
  ```typescript
  export interface MapPin {
    listingKey: string;
    x: number; // SVG viewBox units, 0-200
    y: number;
    distanceMiles: number;
  }

  export interface CompMapLayout {
    viewBoxSize: number; // always 200
    subject: { x: number; y: number }; // always the center, { x: 100, y: 100 }
    pins: MapPin[];
    radiusMiles: number; // the farthest pin's distance -- what the boundary circle, if drawn, represents
  }

  export function layoutCompMap(subject: LatLng, comps: Array<LatLng & { listingKey: string }>): CompMapLayout
  ```

- [x] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { layoutCompMap } from "@/lib/report-formatting";

const SUBJECT = { latitude: 47.67, longitude: -122.38 };

describe("layoutCompMap", () => {
  it("places the subject at the exact center of the viewBox", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "A", latitude: 47.68, longitude: -122.37 }]);
    expect(layout.subject).toEqual({ x: 100, y: 100 });
    expect(layout.viewBoxSize).toBe(200);
  });

  it("places a comp due north closer to the top (smaller y) than the subject", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "N", latitude: SUBJECT.latitude + 0.01, longitude: SUBJECT.longitude }]);
    expect(layout.pins[0].y).toBeLessThan(100);
    expect(layout.pins[0].x).toBeCloseTo(100, 0);
  });

  it("scales the farthest comp near the edge, not past it", () => {
    const layout = layoutCompMap(SUBJECT, [
      { listingKey: "Near", latitude: SUBJECT.latitude + 0.001, longitude: SUBJECT.longitude },
      { listingKey: "Far", latitude: SUBJECT.latitude + 0.02, longitude: SUBJECT.longitude },
    ]);
    const far = layout.pins.find((p) => p.listingKey === "Far")!;
    expect(far.y).toBeGreaterThan(10); // inside the 200-unit canvas with padding, not clipped at 0
    expect(far.y).toBeLessThan(100);
  });

  it("never divides by zero with a single comp at the same coordinates as the subject (Review Focus #1/#2)", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "Same", latitude: SUBJECT.latitude, longitude: SUBJECT.longitude }]);
    expect(Number.isFinite(layout.pins[0].x)).toBe(true);
    expect(Number.isFinite(layout.pins[0].y)).toBe(true);
    expect(Number.isFinite(layout.radiusMiles)).toBe(true);
  });

  it("handles zero comps without throwing (Review Focus #2)", () => {
    const layout = layoutCompMap(SUBJECT, []);
    expect(layout.pins).toEqual([]);
    expect(Number.isFinite(layout.radiusMiles)).toBe(true);
  });

  it("fits a comp far outside a typical search radius on-canvas (Review Focus #3)", () => {
    const layout = layoutCompMap(SUBJECT, [{ listingKey: "Far", latitude: SUBJECT.latitude + 5, longitude: SUBJECT.longitude }]);
    expect(layout.pins[0].y).toBeGreaterThanOrEqual(0);
    expect(layout.pins[0].y).toBeLessThanOrEqual(200);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/report-formatting.test.ts`
Expected: FAIL with "layoutCompMap is not a function" (or similar — the export doesn't exist yet).

- [x] **Step 3: Implement `layoutCompMap` in `src/lib/report-formatting.ts`**

Equirectangular approximation (fine at this scale — comps are at most tens of miles out, never a real map-projection distance): convert each comp's lat/long delta from the subject into miles (≈69.0 mi/degree latitude; ≈69.172 × cos(subject latitude in radians) mi/degree longitude), scale so the farthest comp lands at `viewBoxSize/2 × (1 − padding)` from center (pick a padding fraction, e.g. 0.15, so labels near the farthest pin don't clip at the edge), guard the scale divisor against zero (empty `comps`, or every comp at the subject's exact coordinates) by flooring the max distance at a small epsilon before dividing. Y decreases as latitude increases (north is up, SVG y grows downward). `radiusMiles` is the real (unfloored) farthest distance, reusing `distanceMiles` from `geo.ts` for each pin's own `distanceMiles` field too — don't compute distance two different ways in the same function.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/report-formatting.test.ts`
Expected: PASS, all 6 tests.

- [x] **Step 5: Commit**

```bash
git add src/lib/report-formatting.ts tests/report-formatting.test.ts
git commit -m "Add layoutCompMap: pure geometry for the subject/comp map"
```

---

## Task 3: Photo assignment (pure, shared logic) + bundled photo assets

**Files:**
- Modify: `src/lib/report-formatting.ts`
- Create: `public/images/properties/` (the bundled photo files)
- Test: `tests/report-formatting.test.ts` (same file as Task 2, new `describe` block)

**Interfaces:**
- Produces:
  ```typescript
  // propertySubType uses the same union as Property["propertySubType"] (db/schema.ts)
  export function photoForListing(listingKey: string, propertySubType: string): string
  // returns a path under /images/properties/, e.g. "/images/properties/single-family-3.jpg"
  ```

- [x] **Step 1: Source ~15-20 properly-licensed, free-for-commercial-use exterior house photos**

Search Wikimedia Commons (reliably CC0/public-domain/CC-BY licensed, no API key, directly `curl`-able URLs, explicit per-file license shown on each file page — confirm the license on each one picked) for a spread across single-family houses, condos/apartment exteriors, and townhouses — roughly 5-7 photos per `propertySubType` bucket (`SingleFamilyResidence`, `Condominium`, `Townhouse`, matching `src/lib/db/schema.ts`'s `propertySubType` enum). Download into `public/images/properties/`, named by bucket and index (e.g. `single-family-1.jpg` … `single-family-6.jpg`, `condo-1.jpg` …, `townhouse-1.jpg` …). Record each file's source URL and license in a short `public/images/properties/SOURCES.md` for attribution/audit.

- [x] **Step 2: Write the failing tests**

```typescript
describe("photoForListing", () => {
  it("is deterministic -- the same listing key always returns the same photo", () => {
    const first = photoForListing("WA-000123", "SingleFamilyResidence");
    const second = photoForListing("WA-000123", "SingleFamilyResidence");
    expect(first).toBe(second);
  });

  it("returns a photo from the matching sub-type bucket", () => {
    expect(photoForListing("WA-000001", "Townhouse")).toContain("townhouse");
    expect(photoForListing("WA-000001", "Condominium")).toContain("condo");
  });

  it("spreads across the bucket rather than always returning the first photo", () => {
    const photos = new Set(
      Array.from({ length: 20 }, (_, i) => photoForListing(`WA-${i.toString().padStart(6, "0")}`, "SingleFamilyResidence")),
    );
    expect(photos.size).toBeGreaterThan(1);
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/report-formatting.test.ts -t photoForListing`
Expected: FAIL with "photoForListing is not a function".

- [x] **Step 4: Implement `photoForListing` in `src/lib/report-formatting.ts`**

Hash `listingKey` to a small non-negative integer (a simple string hash is fine — this has no security property to uphold, only needs to spread deterministically), map `propertySubType` to its bucket name and file count from Step 1's actual file set, return `/images/properties/{bucket}-{(hash % count) + 1}.jpg`.

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/report-formatting.test.ts`
Expected: PASS, all tests from Task 2 and Task 3.

- [x] **Step 6: Commit**

```bash
git add src/lib/report-formatting.ts tests/report-formatting.test.ts public/images/properties/
git commit -m "Add photoForListing + bundled placeholder property photos"
```

---

## Task 4: Comp coordinates at render time (data-fetching, both report routes)

**Files:**
- Modify: `src/app/api/reports/[id]/logic.ts` (`getReport`) and its test file
- Modify: `src/app/api/admin/reports/[id]/logic.ts` (`getAdminReport`) and its test file

**Interfaces:**
- Consumes: `DataProvider.getProperty(listingKey: string): Promise<Property | null>` (existing, `@/lib/data/provider`).
- Produces: `ReportBody` (and the admin equivalent) gains an optional field:
  ```typescript
  mapPositions?: {
    subject: { latitude: number; longitude: number } | null; // null if sourceListingKey is missing or no longer in `property` (Review Focus #5)
    comps: Array<{ listingKey: string; latitude: number; longitude: number }>; // only comps actually found; a missing one is silently omitted, never throws
  }
  ```
  Only populated when `status === "succeeded"` and `result` exists — a running/failed report has nothing to map.

- [x] **Step 1: Write the failing test** (in the existing test file for `getReport`)

```typescript
it("includes map positions looked up from the property table, by listingKey, for a succeeded report", async () => {
  // Arrange: insert a succeeded report whose result.selectedComps reference seeded property rows
  // Act: const body = await getReport(db, reportId, accessCodeId);
  // Assert: body.mapPositions.comps has one entry per selectedComp, each with the seeded lat/long
});

it("omits a comp from mapPositions if its listingKey is no longer in property, without throwing (Review Focus #5)", async () => {
  // Arrange: a selectedComp listingKey that was never seeded
  // Assert: getReport resolves normally; mapPositions.comps simply doesn't include that key
});

it("sets mapPositions.subject to null when the report has no sourceListingKey or it's missing from property", async () => {
  // Assert: no throw, subject: null
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/app/api/reports.test.ts -t mapPositions` (adjust to the actual existing test file path for `getReport`)
Expected: FAIL — `mapPositions` is `undefined`, not the expected shape.

- [x] **Step 3: Implement in `getReport`**

After confirming `status === "succeeded"` and `result` exists, build `provider.getProperty(listingKey)` calls via `Promise.all` for every `result.selectedComps[].listingKey` plus (if present) the stored subject's `sourceListingKey` (read from the stored `reports.subject` jsonb, same place `unparsedAddress` already comes from per the reports-list feature). Filter out any `null` lookups rather than failing the whole request. Attach as `mapPositions` on the returned body.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/app/api/reports.test.ts`
Expected: PASS.

- [x] **Step 5: Repeat Steps 1-4 for `getAdminReport`** (`src/app/api/admin/reports/[id]/logic.ts` and its test file) — identical shape and logic, operator-report path.

- [x] **Step 6: Commit**

```bash
git add src/app/api/reports/[id]/logic.ts src/app/api/admin/reports/[id]/logic.ts tests/app/api/reports.test.ts tests/app/api/admin/reports.test.ts
git commit -m "Look up comp/subject coordinates at render time for the comp map"
```

---

## Task 5: Subject card + comp map + photo-forward rows — web (`ReportView.tsx`)

**Files:**
- Modify: `src/app/_components/ReportView.tsx`
- Modify: `src/app/cma/[id]/page.tsx` and `src/app/admin/reports/[id]/page.tsx` (pass the new `mapPositions` prop through from Task 4's `ReportBody`)

**Interfaces:**
- Consumes: `layoutCompMap` and `photoForListing` from `@/lib/report-formatting` (Tasks 2-3); `mapPositions` from `ReportBody` (Task 4).
- No new tests — matches this codebase's existing, already-established precedent that `/cma` and `/admin` page-level UI is verified by manual browser check, not unit tests (see `ReportView.tsx`'s own prior art and `CLAUDE.md`).

- [x] **Step 1: Add a `SubjectCard` section** at the top of `ReportView`'s result rendering (above "Comparable sales"), using `report.subject`'s existing fields (area, sub-type, beds/baths/size — already read today) plus the stored `unparsedAddress` (same fallback-to-area pattern the reports list already uses for older reports with no address) and a `font-heading` styled address line. Visually distinct card treatment (border/background) from the comps list below it, so it reads as "what we're comparing against," not another row.

- [x] **Step 2: Add a `CompMap` SVG section** below the subject card, only rendered `if (mapPositions)`. Call `layoutCompMap(mapPositions.subject ?? report.subject, mapPositions.comps)`. Render: a subject pin (filled `--color-primary`, larger) at `layout.subject`, a comp pin (outline or `--color-accent`-colored, smaller) per `layout.pins`, each comp pin labeled with its `adjustedValue` (already available from `result.selectedComps`, matched by `listingKey`) via an inline SVG `<text>`. Hand-drawn teardrop/pin `<path>`, no icon library (Global Constraints).

- [x] **Step 3: Add photos to the comparable-sales rows.** For each `result.selectedComps` row, call `photoForListing(comp.listingKey, subject.propertySubType)` (the comp's own sub-type isn't on `CmaResult` today — using the subject's is an acceptable simplification worth noting as a known simplification in the commit message, not a bug) and render a small thumbnail beside the address, with a "Representative image" caption beneath it (design doc decision).

- [x] **Step 4: Thread `mapPositions` through** `src/app/cma/[id]/page.tsx` and `src/app/admin/reports/[id]/page.tsx` as a new prop on `<ReportView>`.

- [x] **Step 5: `npm run build` to confirm no type errors**

Run: `npm run build`
Expected: succeeds.

- [x] **Step 6: Manual browser check** (matches this project's established pattern for UI-only changes): log in, open a succeeded report, confirm the subject card, map (subject centered, comps placed plausibly, price labels legible), and photo-forward comp rows all render correctly, with disclosures still present and no console errors. Check both `/cma/[id]` and `/admin/reports/[id]`.

- [x] **Step 7: Commit**

```bash
git add src/app/_components/ReportView.tsx src/app/cma/\[id\]/page.tsx src/app/admin/reports/\[id\]/page.tsx
git commit -m "Add subject card, comp map, and photo-forward rows to the results view"
```

---

## Task 6: Subject card + comp map + photo-forward rows — PDF (`report-document.tsx`)

**Files:**
- Modify: `src/lib/pdf/report-document.tsx`
- Modify: `src/app/api/reports/[id]/pdf/logic.ts` and `src/app/api/admin/reports/[id]/pdf/logic.ts` (pass `mapPositions` through to `ReportDocument`)
- Modify: `tests/pdf/report-document.test.ts` (existing file, per Step 10's own proof pattern — extracts PDF text with `unpdf` and checks sections)

**Interfaces:**
- Consumes: same `layoutCompMap`/`photoForListing` as Task 5, plus `mapPositions` (now threaded into `ReportDocument`'s props: `ReportDocument({ subject, result, mapPositions })`).
- react-pdf's own `<Svg>`, `<Circle>`/`<Path>`, `<Text>`, `<Image>` primitives — not the same JSX as Task 5's browser SVG, but the same `layoutCompMap`/`photoForListing` function calls feed both.

- [x] **Step 1: Write the failing test** — extend the existing `report-document.test.ts` (same pattern it already uses: render with `unpdf`, extract text)

```typescript
it("includes the subject's address on the cover/subject section when mapPositions is provided", async () => {
  // render ReportDocument with a fixture mapPositions, extract text, assert the address appears
});

it("renders without the map section when mapPositions is undefined (an old report re-rendered, or one missing lookups)", async () => {
  // Review Focus #4/#5 -- must not throw
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pdf/report-document.test.ts`
Expected: FAIL (new prop/section doesn't exist yet).

- [x] **Step 3: Implement in `report-document.tsx`**

Register Task 1's bundled Outfit `.ttf` files via `Font.register({ family: "Outfit", fonts: [...] })` at module load, apply to the cover title and section headings (`styles.coverTitle`, `styles.h1`) in place of `Helvetica-Bold`. Update `styles.recommendationValue` and any other color-coded style from the old `#2563eb` to the new `--color-primary` hex (Task 1's value — hardcode it here, since react-pdf styles can't read CSS variables; keep the two values in sync by eye, same as today's existing hardcoded `#2563eb`/`#1e293b` throughout this file already are). Add a `SubjectSection` component (address, facts) above `ComparablesTable`. Add a `CompMap` component using react-pdf's `<Svg>/<Circle>/<Text>` for the pins, rendered only `if (mapPositions)`. Add an `<Image>` thumbnail + "Representative image" `<Text>` caption to each row in `ComparablesTable`, using `photoForListing`.

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/pdf/report-document.test.ts`
Expected: PASS.

- [x] **Step 5: Thread `mapPositions`** from `renderReportPdf` (both the end-user and admin PDF logic files) into `ReportDocument`.

- [x] **Step 6: Visual review** (matches Step 10's own established proof pattern): download a real PDF through the live route against real data, read it directly — confirm the cover's new typeface, the subject section, the map, and photo thumbnails with captions all render cleanly, with no garbled text or broken layout, disclosures still on every page.

- [x] **Step 7: Commit**

```bash
git add src/lib/pdf/report-document.tsx src/app/api/reports/\[id\]/pdf/logic.ts src/app/api/admin/reports/\[id\]/pdf/logic.ts tests/pdf/report-document.test.ts
git commit -m "Add subject section, comp map, and photos to the PDF report"
```

---

## Task 7: Admin Overview — KPI-style stat cards

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `AdminOverview` (existing, unchanged shape — `health`, `monthlySpendUsd`, `stuckReports`, `lowBalanceCodes`).
- No new tests (pure presentational change to an already-untested server component page, same precedent as the rest of `/admin/*`).

- [x] **Step 1: Restyle the two existing stat boxes** ("Database", "Spend this month") as larger, more prominent KPI cards — bigger number treatment (`font-heading`, larger size), a colored status indicator tied to `overview.health` (not just text color swap — a small dot/icon, matching the existing a11y rule of not conveying state by color alone, so keep the existing text label alongside it).

- [x] **Step 2: `npm run build`**

Run: `npm run build`
Expected: succeeds.

- [x] **Step 3: Manual browser check**: log in as admin, confirm Overview renders correctly with real data, both healthy and (if reachable) unhealthy database states are visually distinct without relying on color alone.

- [x] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "Restyle admin Overview as KPI-style stat cards"
```

---

## Task 8: Consistency pass

**Files:** `src/app/_components/NewCmaForm.tsx`, `src/app/_components/AddressAutocomplete.tsx`, `src/app/cma/page.tsx`, `src/app/cma/reports/page.tsx`, `src/app/admin/reports/page.tsx`, `src/app/admin/codes/page.tsx`, `src/app/cma/layout.tsx`, `src/app/admin/layout.tsx` — exact edits TBD by this point, since this task applies the patterns Tasks 1-7 establish rather than introducing new ones.

This task stays loosely scoped per the design doc's own call ("apply the patterns item 1-3 establish... can't be planned in detail until those patterns exist"). At minimum: apply `font-heading` to every page's `<h1>`, confirm the Task 1 color refresh reads correctly across every screen (not just the ones directly touched above), and re-run the existing Playwright-based manual walkthrough pattern this project has used for every prior UI milestone.

- [x] **Step 1: Sweep every page listed above for heading typography** — apply `font-heading` to top-level headings for visual consistency with Tasks 5-7.
- [x] **Step 2: Visual check of every screen** against the refreshed `--color-primary`/`--color-ring` (buttons, focus rings, links) — confirm nothing still hardcodes the old `#2563eb`.
- [x] **Step 3: `npm test` and a full manual walkthrough** (both `/cma/*` and `/admin/*` flows), screenshotting each screen.
- [x] **Step 4: Commit**

```bash
git commit -am "Apply refreshed design tokens consistently across remaining screens"
```

---

## Self-review notes

- **Spec coverage:** every "Adopt" item in the design doc has a task (comp map → Tasks 2/5/6; subject prominence → Tasks 5/6; photo-forward rows → Tasks 3/5/6; display typeface → Task 1; KPI stat cards → Task 7; consistency pass → Task 8). Both "Theirs" decisions (photo sourcing, labeling) are Task 3 Step 1 and Task 5/6 Step 3's caption, respectively.
- **Review Focus coverage:** all 5 lines have an owning test in Task 2 or Task 4.
- **Type consistency:** `MapPin`/`CompMapLayout` (Task 2) and `photoForListing`'s return type (Task 3) are the only new shared types; both are used identically in Tasks 5 and 6's descriptions.
- **Known simplification, not a gap:** Task 5 Step 3 notes that comp photos use the *subject's* `propertySubType` rather than each comp's own (not present on `CmaResult`) — acceptable (a photo is illustrative, not data), but flagged so it's a deliberate call, not an oversight found later.
