# Landing Page + Report View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the landing/access page and the report view to match the approved Artifact mockups — real-estate-firm visual language on the landing page, and a complete, visually polished Subject Property section on the report view — using only tokens already shipped in the prior UI/UX redesign phase.

**Architecture:** Pure presentation-layer change to three existing files (`page.tsx`, `AccessForm.tsx`, `ReportView.tsx`). One new pure helper (`subjectStatTiles`) joins the existing shared formatting module (`report-formatting.ts`) alongside `humanizeEnum`/`layoutCompMap`/`photoForListing`, since it has real conditional logic (the lot-size-null fallback) worth testing — everything else in this plan is markup/Tailwind restructuring with no new logic, proven by `next build` plus a manual browser check, matching this codebase's own established precedent (zero React component tests exist anywhere in the repo today).

**Tech Stack:** Next.js 16 App Router, React 19 Server/Client Components, Tailwind CSS v4 (CSS custom properties via `@theme inline`), Vitest.

**Spec:** [docs/superpowers/specs/2026-10-15-landing-report-redesign-design.md](../specs/2026-10-15-landing-report-redesign-design.md)

## Global Constraints

- No new colors or fonts — reuse `--color-primary` (`#1e3a5f`), `--color-accent` (`#ea580c`), `--color-foreground`, `--color-muted-foreground`, `--color-border`, `--color-card`, `--color-background` from `src/app/globals.css`, and the existing `font-heading` (Outfit) / `font-sans` (Plus Jakarta Sans, the body default) Tailwind utilities. Reference colors with Tailwind's arbitrary-value custom-property syntax (`text-(--color-foreground)`), never a hardcoded hex, matching every existing component in this codebase.
- No fabricated testimonials, client logos, or stats on the landing page (design doc anti-goals) — the capability row states only what the product actually does today.
- No colored left-border stripe on any stat card on screen (design doc anti-goals) — full border, hierarchy from typography only. This applies to the *web* Subject Property tiles only; the PDF's existing left-border tiles are out of scope and unchanged.
- Comparable sales table keeps its current 6 columns (Photo | Address | Weight | Base price | Adjustment | Adjusted value) — confirmed via side-by-side mockup comparison; no column merge.
- Disclosures (`SAMPLE_DATA_DISCLOSURE`, `NOT_APPRAISAL_DISCLOSURE`) already render once, globally, in `src/app/layout.tsx`'s `<footer>` — do not add a second disclosure block to `page.tsx` or `ReportView.tsx`.
- `npm test` (typecheck, lint, vitest) must pass before every commit.
- This codebase has no existing Tailwind breakpoint (`sm:`/`md:`/`lg:`) precedent anywhere — every page achieves responsiveness today with plain flexbox and `max-w-*`, no breakpoint utilities. Follow that same approach (`flex-wrap`, `min-width`, no new breakpoint prefixes) rather than introducing a new pattern.

## Review Focus

- A subject with `lotSizeSquareFeet: null` (freely-typed subject, never matched to a listing) — the Lot Size tile must show "Not on file", not "null sq ft" or a crash. Covered in Task 1's test.
- A subject with no `unparsedAddress` (no address-autocomplete match) — the report view's heading must still fall back to `mlsAreaMajor`, exactly as it does today; this plan must not regress that existing fallback while restyling around it.
- A report with exactly one selected comp (the engine's own floor — `submitCmaInputSchema` allows as few as 1) — the comparable sales table and adjustment grid must render one row cleanly, not assume ≥2 rows anywhere in spacing/dividers.
- A long `propertySubType`/address string (e.g. a long street name) inside a stat tile or the page heading — must wrap, not clip or overflow its container.
- The landing page at a narrow (phone-width) viewport — the hero's two-column split must collapse to a single column (content/form first, photo below, matching the mockup's DOM order and keeping the primary action above the fold), no horizontal scroll.

---

### Task 1: `subjectStatTiles` helper + ReportView's Subject Property section

**Files:**
- Modify: `src/lib/report-formatting.ts`
- Modify: `src/app/_components/ReportView.tsx`
- Test: `tests/report-formatting.test.ts`

**Interfaces:**
- Produces: `interface SubjectStatTile { label: string; value: string }` and `function subjectStatTiles(subject: Subject): SubjectStatTile[]` (imports `Subject` from `@/lib/engine/adjustments`, same type already imported by `report-formatting.ts`'s neighbors). Returns exactly 9 tiles, in this order: Neighborhood / Area, Property Type, Bedrooms, Bathrooms, Living Area, Lot Size, Year Built, Garage Spaces, Condition. Address is deliberately excluded — the page already renders it as the heading above this grid.

- [ ] **Step 1: Write the failing tests**

```ts
import { subjectStatTiles } from "@/lib/report-formatting";

const SUBJECT_FULL: Subject = {
  latitude: 47.67, longitude: -122.38, mlsAreaMajor: "Ballard",
  propertySubType: "SingleFamilyResidence", bedroomsTotal: 3, bathroomsTotalInteger: 2,
  livingArea: 2000, lotSizeSquareFeet: 5000, yearBuilt: 2000, garageSpaces: 1,
  propertyCondition: "Good",
};

describe("subjectStatTiles", () => {
  it("returns all 9 fields with humanized labels, address and the heading excluded", () => {
    const tiles = subjectStatTiles(SUBJECT_FULL);
    expect(tiles).toHaveLength(9);
    expect(tiles.map((t) => t.label)).not.toContain("Address");
    expect(tiles).toContainEqual({ label: "Property Type", value: "Single Family Residence" });
    expect(tiles).toContainEqual({ label: "Lot Size", value: "5,000 sq ft" });
    expect(tiles).toContainEqual({ label: "Condition", value: "Good" });
  });

  it("shows 'Not on file' when lotSizeSquareFeet is null", () => {
    const tiles = subjectStatTiles({ ...SUBJECT_FULL, lotSizeSquareFeet: null });
    expect(tiles).toContainEqual({ label: "Lot Size", value: "Not on file" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/report-formatting.test.ts -t subjectStatTiles`
Expected: FAIL — `subjectStatTiles` is not exported

- [ ] **Step 3: Implement `subjectStatTiles` in `src/lib/report-formatting.ts`**

Place it near `humanizeEnum` (reuse that function for the Property Type value). Mirrors the field list and "Not on file" fallback already shipped in `src/lib/pdf/report-document.tsx`'s `SubjectPropertySection`, minus the Address tile.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/report-formatting.test.ts -t subjectStatTiles`
Expected: PASS

- [ ] **Step 5: Redesign `ReportView.tsx`'s Subject Property section**

Replace the current single `<section>` (lines ~92–101: the one-line `mlsAreaMajor · propertySubType · bed/bath · sq ft` summary) with: the existing address-or-area heading kept as-is, then a `grid grid-cols-3 gap-4` of `subjectStatTiles(subject)` rendered as cards — each card `rounded-lg border border-(--color-border) bg-(--color-card) p-4`, label `text-xs font-semibold tracking-wide text-(--color-muted-foreground) uppercase`, value `font-heading text-lg font-bold text-(--color-foreground)`. No left-border accent (Global Constraints).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions

- [ ] **Step 7: Commit**

```bash
git add src/lib/report-formatting.ts tests/report-formatting.test.ts src/app/_components/ReportView.tsx
git commit -m "feat: add subjectStatTiles helper, give ReportView a complete Subject Property grid"
```

---

### Task 2: Value range card, comp map pairing, and rationale pull-quote in `ReportView.tsx`

**Files:**
- Modify: `src/app/_components/ReportView.tsx`

**Interfaces:**
- Consumes: Task 1's redesigned Subject Property section (this task's changes sit directly below it in the same component) — no interface dependency, purely sequential sections in the same file.

- [ ] **Step 1: Pair the comp map and value range into one flex row**

Wrap the existing comp-map `<section>` and value-range `<section>` in a `flex flex-wrap gap-6` parent, each `flex-1 min-w-[280px]`, so they sit side by side on wide viewports and stack on narrow ones (no breakpoint prefix needed — `flex-wrap` alone handles it, per Global Constraints).

- [ ] **Step 2: Redesign the value-range card**

Give it `border-t-4 border-(--color-primary)` (the 4px navy top-border accent from the mockup) in addition to its existing `border border-(--color-border)`, and `flex flex-col justify-center` so the price range reads as the visual anchor of the row.

- [ ] **Step 3: Redesign the rationale section**

Change the rationale `<section>` to `border-l-[3px] border-(--color-accent) pl-5` (orange pull-quote rule), keeping the existing paragraph text and `aria` semantics untouched.

- [ ] **Step 4: `npm run build`**

Run: `npm run build`
Expected: succeeds, no type/lint errors

- [ ] **Step 5: Commit**

```bash
git add src/app/_components/ReportView.tsx
git commit -m "feat: pair value range with the comp map, add rationale pull-quote treatment"
```

---

### Task 3: Comparable sales table and adjustment grid chrome in `ReportView.tsx`

**Files:**
- Modify: `src/app/_components/ReportView.tsx`

**Interfaces:**
- Consumes: nothing new — restyles the existing `comps.map(...)` and adjustment-grid `<table>` markup already in the file (column structure, data bindings, `photoForListing` usage all unchanged per Global Constraints).

- [ ] **Step 1: Wrap both tables in the shared card chrome**

For each of the comparable-sales table and the adjustment-grid table: wrap the existing `<table>` in `rounded-lg border border-(--color-border) bg-(--color-card) overflow-hidden`, and give the `<thead><tr>` a `bg-(--color-background)` background. Keep every existing `<th>`/`<td>` (columns, photo cell, zero-value `—` handling) exactly as-is — this step only adds the surrounding container and header background.

- [ ] **Step 2: `npm run build`**

Run: `npm run build`
Expected: succeeds, no type/lint errors

- [ ] **Step 3: Manual browser check (covers this task's Review Focus items)**

Run `npm run dev`, open a real report (or a freshly generated one) and confirm: a single-comp report renders one clean row in both tables with no layout break; a long property-type string in the Subject Property grid wraps instead of clipping; the comp-map/value-range row stacks correctly at a narrow window width with no horizontal scroll; and a report whose subject has no `unparsedAddress` (a freely-typed subject with no address-autocomplete match) still shows the `mlsAreaMajor` fallback as the heading, unchanged from today's behavior.

- [ ] **Step 4: Commit**

```bash
git add src/app/_components/ReportView.tsx
git commit -m "feat: card chrome for the comparable sales table and adjustment grid"
```

---

### Task 4: Landing page redesign

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/_components/AccessForm.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1–3 (independent screen). Keeps `page.tsx`'s existing server-side redirect-if-authenticated logic and `AccessForm.tsx`'s existing `handleSubmit`/error-copy logic completely unchanged — this task only replaces returned JSX/classNames.

- [ ] **Step 1: Redesign `page.tsx`'s returned markup**

Replace the current centered single-column `<main>` with the mockup's structure: a slim top bar (`CMA Agent` wordmark, `font-heading font-bold text-(--color-primary)`) followed by a `flex flex-wrap` hero row — left side (`flex-1 min-w-[420px]`, centered content, `gap-9`) holding an eyebrow label ("AI Comparative Market Analysis", `text-(--color-primary)` uppercase), the headline ("Know what a home is worth, backed by the comps.", `font-heading font-bold text-4xl`), the existing descriptive paragraph (keep its current wording), a factual 3-item capability row (Comparable sales search / Adjustment grid + rationale / Branded PDF export — plain text + checkmark SVG, no fabricated claims per Global Constraints), and `<AccessForm />`; right side (`flex-1 min-w-[360px]`, `relative overflow-hidden`) holding a full-bleed `<img>` from `public/images/properties/` (pick any existing single-family photo by a fixed filename — this is static marketing chrome, not per-listing data, so it does not need `photoForListing`'s hashing) with a small "Representative image — sample dataset" caption pill (`absolute bottom-4 left-4`, `bg-(--color-primary)/85 text-(--color-on-primary)`). Do not add a second disclosures block (Global Constraints — root layout already renders one).

- [ ] **Step 2: Restyle `AccessForm.tsx`**

Update spacing/sizing to match the mockup's form treatment (`gap-4`, `px-4 py-3.5` input, full-width submit button) — keep every existing prop, state variable, and the `ERROR_COPY` map byte-for-byte unchanged.

- [ ] **Step 3: `npm run build`**

Run: `npm run build`
Expected: succeeds, no type/lint errors

- [ ] **Step 4: Manual browser check**

Run `npm run dev`, load `/` logged out: confirm the hero photo and form render side by side at desktop width and stack with no horizontal scroll at phone width; submit an invalid code and confirm the existing error copy still displays correctly; confirm the single global disclosure footer still appears once, not twice.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/_components/AccessForm.tsx
git commit -m "feat: redesign the landing page with real-estate-firm visual language"
```

---

## Risks

| Risk | Mitigation |
|---|---|
| Subject Property grid regresses the existing address-or-area fallback | Task 1 only replaces the summary line below the heading, not the heading itself — the existing `subject.unparsedAddress ?? subject.mlsAreaMajor` expression is untouched |
| New `subjectStatTiles` drifts from the PDF's own (already-shipped) field list | Task 1's implementation note explicitly points at `src/lib/pdf/report-document.tsx`'s `SubjectPropertySection` as the field-list source of truth |
| Landing hero photo looks arbitrary without `photoForListing`'s deterministic selection | Acceptable per design doc — this is static marketing chrome shown to every visitor, not a specific listing's representative photo, so a fixed filename is correct, not a shortcut |

## Verification

1. `npm test` green after every task.
2. `npm run build` succeeds after Tasks 2, 3, and 4.
3. Manual browser check per Tasks 3 and 4's steps — no Playwright suite exists in this codebase yet, consistent with its existing precedent for UI-only changes.
4. Push a branch, check the Vercel preview, merge only with explicit approval (this project's established deploy workflow — `CLAUDE.md`).
