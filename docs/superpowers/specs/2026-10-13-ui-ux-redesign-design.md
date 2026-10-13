# Design: UI/UX redesign — enterprise residential real estate language

**Owner:** Khoa Nguyen, Nguyen Design Labs
**Date:** 2026-10-13
**Status:** Proposed — awaiting approval

## Intent and why

Requested directly: "I want to pull in some visual examples of how an enterprise residential real estate application is designed, and adopt some of those design languages and apply them consistently to this project." The current design system (`design-system/cma-agent/MASTER.md`) is generic SaaS — Minimalism/Swiss style, trust-blue + orange, Plus Jakarta Sans. It's clean and accessible but reads as a template, not as a tool built specifically for real estate professionals. Separately raised and folded in here (the operator confirmed the PDF should get the same tasteful treatment, not be designed twice): the subject property gets lost among the comps, both on the results page and in the PDF, and the operator wants photos/visuals the current data-table-only presentation doesn't have.

This document is the proposal from that research — what to adopt, what to deliberately skip, and why — for approval before anything gets built.

## Research

Screenshotted and read 5 real products (not just read-about-them) that a residential real estestate professional would actually recognize as "enterprise-grade" tools in this category, picked to cover different angles: the literal category leader for CMA reports specifically, the industry-standard data platform, a premium consumer-facing brokerage, a broker/agent CRM platform, and a data-intelligence company's brand identity. Screenshots saved in this session's scratchpad if you want to see them directly; summarized here.

1. **Cloud CMA** (cloudcma.com) — the category leader for exactly this product (CMA reports + listing presentations). The single most relevant reference.
   - A **map-based comp view**: subject + comps as pins on an actual map, each pin labeled with its price, a boundary line around the search radius. This is the headline visual for a CMA tool and this app has nothing like it today — comps are a data table only.
   - **Cover-page-as-book**: the CMA report's cover renders like a hardcover book with a full-bleed property photo, title, and "Prepared for [name]."
   - Clean white UI, one confident green accent, bold rounded/geometric sans headlines, generous whitespace.
   - Framing: "interactive presentations that win more listings" — the product is sold on looking impressive in front of a client, not just being correct.

2. **RPR — Realtors Property Resource** (narrpr.com) — the data platform NAR itself provides to every realtor; the closest thing to an industry-standard baseline.
   - Navy blue brand, utilitarian/corporate login screen, a tilted-paper collage showing report + mobile views together.
   - Reads as trustworthy and institutional rather than exciting — useful as a floor for "this looks credible to a licensed professional," not a ceiling for visual ambition.

3. **BoldTrail** (formerly kvCORE, insiderealestate.com) — a broker/agent CRM platform, the closest analog to this app's *admin dashboard* specifically (an operator monitoring activity, leads/reports, and account health).
   - Card-based activity feed: each row combines a property photo thumbnail, contact name, a colored status pill ("New Lead", "Validated"), and inline actions (Email/Call/Text buttons) — not a plain table.
   - A **floating KPI callout card** ("Total Vital Score 94%, 30-Day Snapshot") overlaid on the dashboard screenshot — a pattern for surfacing one headline number prominently rather than burying it in a stat row.
   - Bold, confident geometric sans headlines (not the generic-SaaS feel of Plus Jakarta Sans).
   - Navy + magenta/pink gradient brand accent, used aggressively (gradient buttons, bright pink CTAs).

4. **Compass** (compass.com) — premium consumer-facing brokerage, included for contrast/aspiration on tone.
   - Serif display headlines ("See It First™ on Compass") over a full-bleed photographic hero, warm and editorial rather than corporate.
   - Confirms that "premium real estate" in this market often leans on **serif display type + real photography**, not pure geometric-sans SaaS styling.

5. **Cotality** (formerly CoreLogic, corelogic.com) — a property-data intelligence company's brand identity, included for how an "enterprise data" brand signals confidence.
   - Bold, large-scale condensed display type, high-contrast dark mode, abstract geometric brand marks.
   - Less directly reusable (this app isn't a dark-mode brand-identity site), but confirms bold, confident display typography reads as "serious data tool" across this whole category, not just one product.

## Design direction (the proposal)

**Keep:** the Minimalism/Swiss foundation (clean, high-contrast, grid-based — the style guide's own "Best For" list already says "enterprise apps, dashboards... professional tools," which is correct) and the existing accessibility bar (4.5:1 contrast, visible focus states, `prefers-reduced-motion`, no emoji icons). None of that is wrong; it's the ingredient list that needs more real-estate character.

**Adopt:**
- **A comp map, drawn as inline SVG — not a mapping library.** Every property already has `latitude`/`longitude` (RESO fields, already in the schema). A simple relative-position projection (subject centered, comps placed by real bearing/distance within the search radius, each pin labeled with its adjusted value) delivers Cloud CMA's headline visual with zero new dependencies, no API key, no per-load cost, and — because `@react-pdf/renderer` renders SVG — the *exact same component* (or a closely shared one) works in both the web results page and the PDF. This is the single highest-impact change and directly solves "the subject gets lost": on a map, the subject is unmissably the center.
- **Subject property as its own prominent card/section**, address + facts + (per the earlier decision) a placeholder/stock photo, visually distinct from the comps list — on the results page, in the PDF, and implicitly on the map (center pin, different marker style from comps).
- **Photo-forward comp rows**, using placeholder/stock images (per the earlier decision — not fabricated-realistic photos of fictional addresses), so comps read as properties, not spreadsheet rows. Matches BoldTrail's card pattern.
- **One confident display typeface for headlines**, paired with the existing body font (or a close relative) for everything else — moves away from "one font for everything" template feel toward the bolder headline treatment every reference product uses, at near-zero cost (one more Google Fonts weight).
- **A KPI-callout treatment on the admin Overview screen** — "Spend this month," "Stuck reports," etc. become clearer stat cards with one standout number each, closer to BoldTrail's floating-stat pattern, instead of the current plain bordered boxes.

**Deliberately not adopting:**
- **BoldTrail's loud magenta/pink gradient.** It reads as "startup CRM," not "institutional trust tool for a valuation product." The brief asked for *tasteful*; a confident, restrained palette serves that better than a bright gradient.
- **Any new mapping/tile service dependency** (Mapbox, Google Maps, Leaflet) — the self-drawn SVG approach above gets the real visual win without a new external service, a new API key to manage, or a usage-based cost this project doesn't currently have.
- **A ground-up visual rebuild.** This is a refinement — new typography pairing, new comp-map and subject-card components, photo treatment, admin stat cards — not a different design system from scratch. Existing components (forms, the overlay modal, buttons) keep their current structure and just inherit refined tokens.

## Scope

Listed below in **user-value priority order** — this is not the build order. **Execution order differs:** design tokens (item 2) must be decided and the PDF's chosen typeface bundled as a local font file *before* the PDF (item 1) is built, not after — react-pdf needs a registered font file, not a Google Fonts `<link>`, and building the PDF once on today's font then restyling it later means doing the PDF twice. So the actual build sequence is **2 → 1 → 3 → 4**, even though 1 delivers the most user-visible value.

1. **PDF report** (`report-document.tsx`) + its web-view twin (`ReportView.tsx`) — subject card, comp map, photo-forward comp rows. Highest value: this is the client-facing deliverable and where "the subject gets lost" was raised.
2. **Design tokens** — typography pairing (including sourcing the chosen display font as a bundled file for react-pdf, not just a Google Fonts link), any palette refinement — applied via `design-system/cma-agent/MASTER.md`, regenerated/updated through `ui-ux-pro-max` the same way the original system was built.
3. **Admin Overview** — KPI-callout stat cards.
4. Pass over remaining screens (`/cma/new`, `/cma/reports`, `/admin/*` lists) for consistency once the above establishes the new component patterns.

**Plan granularity (my default, flagged for you to override):** one plan covering all four items, executed and reviewed step by step in this project's existing pattern (each item lands as its own commit/review before the next starts) rather than four separate brainstorm-to-plan cycles. Item 4 stays loosely scoped in the plan itself ("apply the patterns item 1-3 establish") since it can't be planned in detail until those patterns exist.

## Goals / non-goals / anti-goals

- **Goal:** a user who's used RPR, Cloud CMA, or a brokerage CRM recognizes this as belonging to that category within seconds, not as a generic SaaS template.
- **Goal:** the subject property is unmistakably the anchor everywhere it appears (results page, map, PDF).
- **Non-goal:** new backend features (market trend charts, neighborhood stats) — those are data/engine scope, not a visual redesign, and out of scope here even though the research surfaced them as a category pattern.
- **Non-goal:** a new mapping/geocoding service or any new paid dependency.
- **Anti-goal:** it would be a failure if this shipped looking louder/busier than today but no clearer — "tasteful" was explicit in the brief, and restraint is itself a design decision, not the absence of one.

## Constraints

- No new runtime dependencies without the usual vetting (Code Standards in CLAUDE.md) — the SVG-map approach is specifically chosen to need none.
- Accessibility bar from the existing design system carries over unchanged (contrast, focus states, reduced motion).
- `@react-pdf/renderer` has a smaller feature set than a browser — the comp-map component needs to be plain SVG with no CSS features react-pdf doesn't support, so it can genuinely be shared (or kept in close lockstep) between web and PDF rather than built twice.
- The chosen display font must be registered with react-pdf as a **bundled local font file**, not a Google Fonts `<link>` (browser-only) and not fetched from a URL at render time (works technically, but adds an external-service round trip and a failure point to every PDF render that a bundled file doesn't have). Downloaded once into the repo (e.g. `public/fonts/`), same one-time cost as any other asset.
- Placeholder/stock images for comps: sourcing responsibility and a disclosure-wording question are still open (see below) — this document doesn't resolve them.

## Resolved during the builder check (my calls, not yours to re-decide unless something here looks wrong)

A fresh-eyes review of this document (dispatched before handing it to you, per the design process) surfaced real gaps. These five I settled myself — they're architectural/technical judgment calls, not preference questions:

1. **Comp coordinates/search radius aren't in the stored report data.** `CmaResult.selectedComps` (what actually gets saved) has no lat/long and no radius — only `Subject` and the raw `property` rows do. **Resolved:** look coordinates up from the `property` table by `listingKey` at render time (same pattern `getReport`/`getAdminReport` already use — one more DB read, not a new one), rather than changing the agent/engine output shape or its tests. For the map's boundary circle: radius = the farthest selected comp's actual distance, not whichever `radiusMiles` the model happened to search with (which can change across retries within one run) — always well-defined, no new field needed.
2. **Old (already-saved) reports.** Resolved as a side effect of #1: since coordinates come from a live DB lookup rather than new fields in the stored jsonb, every existing report renders the map automatically — no backfill, no fallback-rendering branch needed, no new test shape.
3. **Which address goes on the subject card.** `Subject` itself has no address field, but this exact problem was already solved once: the reports-list feature stores `unparsedAddress` alongside `Subject` in the same `reports.subject` jsonb column, with an established fallback to the area label for reports created before that feature shipped. Reuse that, not a new field.
4. **"Prepared for [name]" cover personalization.** It showed up in the Cloud CMA research writeup but was never actually in this document's Adopt list, and no client-name field exists anywhere in the data model. **Explicitly out of scope:** this redesign restyles the existing cover page (bolder treatment, bigger photo) without adding a personalization field. A real feature if wanted later, not a design-system change.
6. *(numbered to match the builder-check report)* **Typography must be chosen before the PDF is built, not after** — folded into Scope above as the 2→1→3→4 execution order.

## Decisions confirmed by the operator

1. **Photo sourcing:** resolved — sourced by the builder (properly-licensed, free-for-commercial-use stock photos, e.g. via Pexels/Unsplash; no image generation, just downloading already-licensed existing photos), not supplied by the operator.
2. **Photo labeling:** resolved — yes, each comp photo carries a small "Representative image" caption.

## Left to the builder (in addition to the earlier list)

3. **Display typeface choice.** A specific pairing (e.g., a geometric/confident sans for headlines alongside the existing body font) gets picked when this goes to `ui-ux-pro-max` for the actual token generation — that tool is built to make this call well with real options to react to.

## What's left to the builder

Specific SVG comp-map geometry/projection math, exact spacing/sizing of the new subject card and comp rows, the regenerated `MASTER.md` tokens (via `ui-ux-pro-max`), and which bundled stock photos map to which property sub-types — all implementation detail for the plan, not design decisions that change what gets built.
