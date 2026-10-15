# Landing page + report view redesign — design

## Intent and why

The 2026-10-13 UI/UX redesign (merged to `main`) re-tokened the app (navy `#1E3A5F` primary, Outfit display type, Plus Jakarta Sans body) and restyled the PDF, the admin Overview, and parts of `ReportView.tsx` — but it never touched the actual landing/access screen (`page.tsx`/`AccessForm.tsx`), and `ReportView.tsx`'s subject summary is still a one-liner missing lot size, garage, year built and condition (the same completeness gap the PDF had before it was fixed).

Khoa asked for two things: research how real real-estate *firms'* sites (not agent-tool SaaS dashboards) present themselves, and bring that visual language to the landing page and the report view — as one cohesive system with what's already shipped, PDF included. Visual direction was approved via three Artifact mockups (Landing, Report view, Individual elements) at https://claude.ai/artifact/FVZBFbgEC2qg771vhBw4Mr.

## Goals

- Landing page (`/`) reads as a real-estate product's first impression, not a generic SaaS login screen: large property photography, restrained editorial type, one clear action.
- `ReportView.tsx`'s Subject Property section shows every data point (address, area, type, bed, bath, living area, lot size, year built, garage, condition) — matching the completeness already shipped in the PDF.
- One visual system end to end: landing page, report view, PDF, and admin dashboard all read as the same product. No new accent color, no new typeface — reuse the tokens already in `design-system/cma-agent/MASTER.md` and `src/app/globals.css`.
- Report view's comparable-sales table stays photo-forward (already shipped) but gains the same visual polish pass as the rest: cleaner table chrome, a clearer value-range focal point, a pulled-out rationale treatment.

## Non-goals

- Not re-opening the token decision (navy/orange/Outfit/Plus Jakarta Sans) — that was decided and shipped in the prior phase.
- Not touching the admin dashboard or PDF further in this phase — PDF is already complete (subject section + branding); admin was already restyled as KPI cards.
- Not adding a marketing/content site (pricing pages, blog, etc.) — this is still a two-screen product (access gate, report), not growing its footprint.

## Anti-goals

- **No fabricated social proof.** CMA Agent runs on sample data and says so on every page (A13). Real-estate-firm landing pages lean hard on testimonials, client logos and transaction stats — none of that is honest here. Borrow the visual *restraint and photography*, not the trust-signal content pattern. The honest substitute is a short, factual capability list (comparable sales search, adjustment grid + rationale, branded PDF export) — true today, not invented.
- **No left-border-accent "stat card" cliché on screen.** The PDF's subject stat tiles use a colored left border (fine in print). The approved web mockup deliberately avoids it — full-bordered cards, hierarchy from type (small-caps muted label over bold value), no colored stripe. Matches this canvas tool's own craft guidance against that specific AI-generated-UI tell.

## Constraints

- Tokens, fonts and the overall Minimalism/Swiss Style system are fixed inputs (`design-system/cma-agent/MASTER.md`) — not decisions this phase makes.
- Disclosures (`SAMPLE_DATA_DISCLOSURE`, `NOT_APPRAISAL_DISCLOSURE`) still render on every screen, unchanged wording (A13).
- No new runtime dependencies — property photography already exists under `public/images/properties/` from the prior phase's `photoForListing`; the landing hero reuses that same bundled set, no new asset pipeline.
- `unparsedAddress` is already threaded through (`Subject & { unparsedAddress?: string }`, same cast pattern `ReportView.tsx` and `pdf/logic.ts` already use) — the Subject Property grid is additive display work, no new data flow.
- `npm test` (typecheck, lint, vitest) must pass before every commit, per this project's CLAUDE.md.

## Decisions from the mockups (approved)

1. **Landing page**: full-height two-column split. Left: wordmark, eyebrow label, headline + subhead (adapted from the existing honest product description, not new marketing copy), a 3-item factual capability row, the access-code form. Right: full-bleed property photo with a small "Representative image — sample dataset" caption pill. Slim top bar (wordmark only) and footer (disclosures) frame it. Collapses to a single column under the photo on narrow viewports (flex-wrap, no fixed `vh`/`%` except the whole-page root).
2. **Report view Subject Property section**: a 3-column grid of 9 stat cards (address gets its own prominent line above the grid as the page's de facto H2, not a tile, since it's already doing double duty as the page's identifying heading) — full border, no left stripe, label small-caps muted over bold value, matching the "Individual elements" mockup's stat-card spec exactly.
3. **Value range**: promoted to its own card with a 4px top border accent (navy) next to the comp map, not buried in a plain bordered box — the single most important number on the page gets the most visual weight.
4. **Rationale**: a left-rule (orange, 3px) pull-quote treatment instead of a plain paragraph, to separate "the agent's reasoning" visually from "the engine's figures" above it.
5. **Comparable sales table**: keep today's 6-column structure exactly as shipped (Photo | Address | Weight | Base price | Adjustment | Adjusted value) — confirmed with Khoa against an Option A (merged Photo+Address, 5 columns) vs. Option B (kept separate) side-by-side mockup; Option B won. Apply the same card chrome (rounded container, subtle header row background, consistent row padding) used elsewhere instead of a bare `<table>`; no column-count change.

## What's left to the builder

- Exact Tailwind class translation of the mockup's inline styles, following this codebase's existing convention (`text-(--color-foreground)` custom-property arbitrary values, not new hardcoded hex in component files).
- Responsive behavior below the mockup's 1440px canvas width (phone/tablet breakpoints) — the mockups show desktop only; apply the design system's existing mobile-first rules (`ui-ux-pro-max`'s layout guidance) to extend the pattern down, consistent with the landing hero's flex-wrap collapse already specified above.
- Any copy micro-adjustments needed once real content is in place (e.g., if the capability row's three items read awkwardly against actual component names).
- Test coverage: `ReportView.tsx` and `page.tsx`/`AccessForm.tsx` have no existing unit tests (consistent precedent across this codebase — no React component tests anywhere yet); proof is `next build` plus a manual/Playwright browser check, same as every other UI step in this project's plans.
