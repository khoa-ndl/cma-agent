# Plan: CMA Agent, Release 1

**Owner:** Khoa Nguyen, Nguyen Design Labs
**Date:** 2026-10-10
**Status:** Approved
**Sources:** [intent.md](intent.md), [spec.md](spec.md)

## Context

`intent.md` and `spec.md` are approved and committed (`e6a5711`, `ceca630`). The repository contains only documentation. This plan sets the build order for Release 1: the files that change, the tests that prove each step, and the risks. Each step is built test-first and ends in a commit. Release 2 will be planned separately.

## Toolchain (current versions verified 2026-10-10)

| Purpose | Package | Notes |
|---|---|---|
| App framework | `next` 16, React, TypeScript, Tailwind CSS | Scaffolded with `create-next-app` |
| AI | `@anthropic-ai/sdk` | Sonnet 5.5, manual tool loop |
| Validation | `zod` | Tool inputs, form inputs, API bodies |
| Database | `drizzle-orm`, `drizzle-kit` | Schema, queries, SQL migrations |
| Database drivers | `@neondatabase/serverless` (sandbox), `@electric-sql/pglite` (tests) | PGlite is the Postgres engine compiled to WebAssembly: tests run on real Postgres with nothing installed (satisfies A16) |
| PDF | `@react-pdf/renderer`; `unpdf` (dev, reads PDF text in tests) | |
| Tests | `vitest`; `tsx` (dev, runs scripts) | |

Package manager: npm. No global installs. Approving this plan approves installing these project dependencies into `node_modules`.

**Not added (lean choices):** no UI component kit, no auth library in Release 1 (signed cookie via Node `crypto`), no rate-limit service (Postgres table), no random-number library (a seeded generator of about 10 lines), no browser-automation framework (manual browser checks; revisit if UI regressions appear).

## Repository layout

```
src/
  app/                    pages and route handlers (UI, /api/*)
  lib/
    db/                   client.ts (swap point), schema.ts, migrations/
    data/                 provider.ts (DataProvider), sample-provider.ts
    engine/               search.ts, adjustments.ts, pricing.ts, config.ts, geo.ts
    agent/                model-client.ts (swap point), tools.ts, loop.ts, prompt.ts
    credits/              access.ts, session.ts, credits.ts
    pdf/                  report-document.tsx
scripts/                  generate-data.ts, seed.ts, issue-code.ts
data/seed/properties.json generated sample dataset (committed)
tests/                    unit and integration tests; tests/live/ for paid API tests
docs/                     intent.md, spec.md, plan.md
```

## Build steps

Each step: write tests first and confirm they fail, implement until they pass, run `npm test`, run `/ponytail-review` on the step's diff, commit.

### Step 0: Commit this plan
- [x] Save as `docs/plan.md` with status "Approved"; commit.

### Step 1: Project scaffold
- [x] `create-next-app` (TypeScript, App Router, Tailwind, ESLint, `src/`), then add vitest, tsx, zod.
- [x] Scripts: `npm test` (type check + lint + vitest, fails on any error) and `npm run test:live` (paid API tests only). The type check runs `next typegen` first, because Next.js 16 generates its route type helpers. **Change:** `db:generate`, `db:migrate`, `db:seed`, `data:generate` and `codes:issue` are added in the steps that create their scripts, so no command points to a missing file.
- [x] `.env.example` (`ANTHROPIC_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_MODEL`), `README.md`, project `CLAUDE.md` with commands and conventions.
- **Proof:** `npm test` runs and passes on a placeholder test; `npm run build` succeeds.
- **Leaner option considered:** no ESLint. Kept, since it ships with `create-next-app` at no extra cost.

### Step 2: Database layer — done (00870e6, branch step-2-database)
- [x] `schema.ts`: `property` (RESO column names, spec 3.1), `access_codes`, `credit_ledger`, `reports`, plus `access_attempts` for rate limiting (see Departures). Also adds a `CHECK (credits_balance >= 0)` constraint, found in review: defense in depth for Step 6.
- [x] Partial unique index `reports(access_code_id) WHERE status = 'running'` (spec 3.3).
- [x] Generated the first SQL migration with `drizzle-kit`; committed.
- [x] `client.ts`: the only file that knows the driver. **Change from the original plan:** uses Neon's HTTP driver (`drizzle-orm/neon-http`), not the WebSocket/Pool driver — found in review to match this plan's own Step 6 assumption ("atomic on any Postgres driver, including Neon's HTTP mode") and to avoid connection-pool exhaustion risk in serverless functions.
- [x] Test helper: fresh in-memory PGlite database per test, explicitly closed in `afterEach` (found in review: the first version leaked instances across a growing test suite).
- **Proof:** 8 tests pass — migrations apply, tables exist, the partial unique index rejects a second running report, and the new CHECK constraint rejects a negative balance.

### Step 3: Sample data generator (A1) — done (bfc0f58, branch step-3-sample-data)
- [x] `scripts/generate-data.ts`: seeded generator for 10 areas, 1,300 closed sales and 200 active or pending listings, per-area price model (spec 3.2). Writes `data/seed/properties.json`.
- [x] `scripts/seed.ts`: loads the JSON into the configured database (idempotent). Untested against a real database — deferred to Step 11, same as `client.ts`.
- **Proof:** 13 tests — deterministic output, RESO shape via zod (`property-schema.ts`, reusing the DB's own enum values), area/status counts, unique listing keys, closes within the trailing 12 months of a fixed generation date.
- **Found in review:** Townhouses were generated with single-family-sized lots; fixed to a small deeded-lot range before merging.

### Step 4: Data provider — done (1e2dc21, branch step-4-data-provider)
- [x] `provider.ts` (interface from spec 2) and `sample-provider.ts` (Drizzle queries).
- [x] Address search: case-insensitive prefix match on `UnparsedAddress`, with the search text's own `%`/`_` escaped so it can't be misread as a wildcard (found in review).
- **Found in review:** `client.ts`'s `Database` type was tied to `NeonHttpDatabase` specifically, so a PGlite test instance couldn't type-check against it — fixed by making it generic over the driver's query-result type, matching the portability design.
- **Proof:** 14 tests on a 6-record fixture: address search (prefix, case, wildcard escaping), get by key, and every `searchListings` filter (status, area, sub-type, size band, close date, exclude key, limit).

### Step 5: Analysis engine (A2, A3) — done (1629dd0, branch step-5-analysis-engine)
- [x] `geo.ts` (distance in miles), `search.ts` (candidates and similarity score), `config.ts` (per-area adjustment table), `adjustments.ts`, `pricing.ts` (weighted range and suggested list price).
- [x] Pure functions with no database or model access, apart from `search.ts` calling the provider.
- **Proof:** 19 tests. A3: hand-calculated adjustments, pricing, distance and similarity score. A2: at least 5 closed comps for a typical (median-sized) subject in all 10 areas, against the full 1,500-record dataset.
- **Found while building:** `search.ts`'s size-band math produced fractional values for an integer column, rejected by Postgres (including the real Neon database); fixed. The first A2 test picked an arbitrary row as "typical," causing a spurious Kirkland failure; switched to the median-sized closed sale per area.
- **Found in review:** adjustment line items weren't rounded before summing, so a printed grid wouldn't add up to its own total; fixed by rounding each line item first.

### Step 6: Access, sessions and credits (A8, A9, A10) — done (0cf6356, branch step-6-access-credits)
- [x] `access.ts`: 128-bit random codes (base32, grouped for readability); stored as SHA-256 hashes, sufficient for random codes with no password-hashing library needed; revocation check; failed attempts rate-limited per IP through `access_attempts` (10 / 15 min).
- [x] `session.ts`: HMAC-signed session token (Node `crypto`, no library), constant-time comparison, 30-day expiry. The HTTP-only cookie itself is set in Step 8.
- [x] `credits.ts`: **reserve/refund/sweepStaleRuns**, each one atomic multi-table SQL statement (chained CTEs), not a client transaction — a single `UPDATE`'s row lock on `access_codes` is what makes concurrent reservations for the same code serialize correctly. Stale sweep runs before every reservation.
- [x] `scripts/issue-code.ts` (`npm run codes:issue -- --label "…" --credits 45`): prints the plain code once, using Node's built-in arg parser.
- **Proof:** 70 tests, 25 new — A8 (deduct/refund, no double-refund), A9 (sequential **and** truly concurrent reservations via `Promise.all`), A10 (insufficient balance, revoked code), rate limiting, stale-run sweep, cookie tamper/expiry/wrong-secret rejection.
- **Found in review:** the rate limiter's check-then-write has a narrow gap under a parallel burst — documented as an accepted limitation (doesn't help guess a 128-bit code, only bounds a request burst) rather than engineered away. The sequential A9 test alone didn't cover the real concurrent-call pattern named in the criterion; added.

### Step 7: Agent (A5, A11, A14; A4 live) — built (5cf5d00, branch step-7-cma-agent); A4 awaiting approval to run
- [x] `model-client.ts`: the only file that imports the Anthropic SDK (swap point for Bedrock, Vertex or Foundry). Model ID from `ANTHROPIC_MODEL`.
- [x] `tools.ts`: `search_comps`, `compute_adjustments`, `compute_price_range`, `submit_cma`, each a zod schema that also generates the tool's JSON Schema. `submit_cma` never trusts a model-echoed number — it looks up each comp's adjustedValue from what `compute_adjustments` actually computed and recomputes the price range itself.
- [x] `loop.ts`: manual tool loop. Emits per-tool-call/result progress events, not per-token (spec 5's UI needs "searching comps…", not a live-typing effect) — the API call itself still streams, to avoid an HTTP timeout. Prompt caching on system prompt and the last tool. Adaptive thinking, effort `medium`. Handles `refusal` and `max_tokens`. Maximum 10 turns and a 50,000-token cumulative ceiling. Imports zero Anthropic SDK runtime code, only the `ModelTurn` function type — what makes it testable with a scripted fake and no cost.
- [x] `tool_choice` stays `auto`; a plain-text turn (no tool call) gets nudged and consumes a turn, rather than failing.
- [x] Server-side refusal fallback (`fallbacks: "default"`) enabled.
- **Proof:** 87 tests, 29 new, scripted fake model, no API cost — A5 (figures equal engine output through the whole loop), A11 (turn limit), A14 (usage/cost), token ceiling, refusal, truncation, plain-text nudge, error recovery.
- **Found in review, asked to specifically trace what the fake-model tests can't catch:** thinking blocks were silently corrupted into empty text blocks when building conversation history — the SDK's own docs say a modified thinking block gets a 400 error on the very next turn, so this would have failed the live test outright. Fixed, with a regression test that inspects what the loop actually sends on the next turn. Separately, `excludedComps`'s `.default([])` still showed up as `required` in the generated schema (confirmed by generating it) — switched to `.optional()`.
- **Live proof (A4) — done:** ran with operator approval. First run failed: Anthropic's strict tool schema rejects JSON Schema bound keywords (`minimum`, `maximum`, `maxItems`, etc.) that zod's `.positive()`/`.max()`/`.min()` generate — a 400 error on every call, something the scripted fake-model tests can't see since they never build real JSON Schema or call the real API. Fixed in `tools.ts` by stripping those keywords from the schema sent over the wire; the zod schema still enforces the bound at runtime, so an out-of-range value from the model still comes back as a tool error. Added a regression test that inspects the generated schema directly. Re-ran: 3/3 passed, $0.136 total (well under the $0.50 estimate) — Ballard $0.0388, Capitol Hill $0.039, Bellevue $0.0581, 1,400–1,500 output tokens each.

### Step 8: API routes (A6, A15) — done, branch step-8-api-routes
- [x] `POST /api/access`: validate code, set session cookie.
- [x] `GET /api/addresses?q=`: autocomplete.
- [x] `POST /api/reports`: validate subject facts, reserve credits, run the agent, stream progress as server-sent events.
- [x] `GET /api/reports/[id]`: status and result, used to recover after a dropped connection.
- [ ] `GET /api/reports/[id]/pdf`: **moved to Step 10.** The renderer it depends on (`report-document.tsx`) doesn't exist yet; building this route now meant either a throwaway stub or dead code, and Step 8's own proof criteria below don't exercise it.
- [x] `GET /api/health`: database round trip; 200 or 503 (A15). Uses `connection()` to opt out of Cache Components' static prerendering — found when `next build` tried to prerender it at build time with no `DATABASE_URL` set, since it touches no other request-time API.
- **Pattern:** each route's logic lives in a plain function taking `db` (and, for `/api/reports`, `modelTurn`) as a parameter — same DI pattern as every `lib/` module — so tests run against the PGlite fixture and the scripted fake model with no cost. `route.ts` is a thin adapter (cookies, query params, `getDb()`/`runModelTurn`) and isn't separately tested, same precedent as `client.ts`/`model-client.ts`.
- **Proof:** 43 new tests (131 total) — SSE events arrive in order, then a `done` event; a successful run persists its result and leaves the reservation in place; a run that hits the turn limit refunds credits and marks the report failed (A8, A11); a report 404s for a different code instead of 403ing (no existence leak); unauthenticated requests rejected on every protected route; health returns 503 when the database is unavailable.
- **Found in review:** the refund and the usage/cost update on a failed run are two separate statements, in the safer order (refund — the money-correct part — first). Left as two statements for now; folding them into one atomic statement is a nice-to-have, not required, since a crash between them can't cause a double-refund or an un-refunded run, only a failed report missing its usage numbers.

### Step 9: User interface (A6, A13) — done, branch step-9-user-interface
- [x] `/`: product description, disclosures, code entry.
- [x] `/cma/new`: address autocomplete, pre-filled editable facts, credit balance.
- [x] `/cma/[id]`: live progress feed, then results (comps table, adjustment grid, range, rationale, excluded comps, PDF button placeholder — real button in Step 10). Falls back to polling the report if the stream drops.
- [x] Disclosures in the root layout so they appear on every page.
- **Design system:** `ui-ux-pro-max` generated one (Minimalism/Swiss style, trust-blue + orange accent, Plus Jakarta Sans, light mode only, subtle motion) — persisted at `design-system/cma-agent/MASTER.md`.
- **Pattern:** the live SSE stream starts and finishes inside `NewCmaForm` on `/cma/new` — it never navigates away mid-stream (a real page transition would cancel the fetch and abandon the agent run, stuck until the stale-run sweep). `window.history.replaceState` swaps the visible URL to `/cma/[id]` as soon as the id is known, purely cosmetic (same mounted component, same open connection); a real navigation only happens once the run is done. `/cma/[id]` itself never starts a run — it always reads the persisted report and polls if still running, which is also what a dropped connection or page refresh lands on.
- **Proof:** 9 new tests (140 total) — the root layout renders both disclosures regardless of its children (A13); the hand-rolled SSE line parser handles events split across chunks; `AddressMatch` carries every fact the form pre-fills; the new `getAccessCodeStatus` balance lookup. The three pages (Server Components reading cookies/db) aren't unit-tested, same precedent as `client.ts`/`model-client.ts` — proven instead by `next build` and the manual walkthrough below.
- **Manual browser check (A6) — done:** full walkthrough against a real Neon database and the real Anthropic API (chromium via Playwright, since `chromium-cli` wasn't installed): access code → `/cma/new` with balance and pre-filled facts → live progress events appear in order before the results page → results render all required sections → disclosures present throughout → no console errors.
- **Found in the manual check, fixed:**
  - `db:seed`, `codes:issue` and `test:live` didn't load `.env` (same root cause as Step 7's A4 fix — `tsx`/plain `node` don't auto-load it, only `next` and `drizzle-kit` do) — fixed by running them through `node --env-file=.env`.
  - `next build` failed prerendering `/cma/[id]`: Cache Components tried to statically prerender it. Fixed with `export const instant = false` on all three pages (the documented migration escape hatch — none of them have a sensible static shell ahead of a session check) plus `await connection()`, which was still needed separately to stop a dev-only "Next.js encountered the unstable value `Date.now()`" error from `verifySessionToken`'s expiry check running before `cookies()` alone registered the route as dynamic.
  - The Adjustment grid section rendered as a bullet list with no structure, including every `$0` line item — rebuilt as a table matching the Comparable sales section, zero values shown as `—`; the Total column was also getting cut off the right edge (9 columns past the content width), fixed by moving Total next to Address and widening the results page.
  - **A real bug, not just UI polish:** `/` only checked the session cookie's signature, while `/cma/new` separately checked whether the code was still active and revoked back to `/`. A cookie stays valid for 30 days regardless of revocation, so a revoked code's lingering cookie bounced `/` → `/cma/new` → `/` forever, locking that browser out of even reaching the login form. Fixed by making `/` check the same active-status condition as `/cma/new`.
- **Fixed after merge:** the address autocomplete dropdown had no keyboard navigation (flagged by the design system's own priority-1 accessibility check — mouse-only blocked keyboard-only and screen-reader users from the one required step on `/cma/new`). Added arrow-key highlighting, Enter-to-select, Escape-to-close and the standard combobox ARIA attributes (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, a `listbox`/`option` structure). Verified with a keyboard-only Playwright walkthrough — no mouse events — confirming the highlighted option, selection, form pre-fill and dropdown close all work.

### Fix: dataset staleness (cuts across Steps 3, 4, 7)

Raised as a side question while reviewing Step 9's manual check, not tied to any one step's checklist.

- **The bug:** the generator pins its output to a fixed `GENERATED_AS_OF` date (2026-10-10) so output stays byte-identical on every run (A1) — but the live agent (`loop.ts`) measured "trailing N months" searches from the real clock (`new Date()`). The two were already a day apart by the time this was caught; given more real time, closed sales clustered in the 12 months before the fixed date would progressively fall outside a live "trailing 12 months" window measured from an ever-later real "today," silently thinning out comps until A2's "at least 5 per area" guarantee broke with no error, just a slow quality decay.
- **Considered and rejected:** regenerating the dataset on a schedule (e.g. weekly) to keep it near real time. Rejected — it fights the generator's actual value (deterministic, reproducible output, which Step 3's own tests depend on), needs new operational infrastructure (a scheduled job, reseed handling) for a problem that's specific to this sandbox's synthetic data, and disappears entirely once a client deployment swaps in a live `ResoWebApiProvider` (spec 2.1) — not worth building for Release 1.
- **The fix:** `DataProvider` gained a `getAsOfDate()` method — what "now" means for that data source. `SampleDataProvider` returns its fixed `GENERATED_AS_OF`; a future live-MLS provider would just return real time. `loop.ts` now calls `provider.getAsOfDate()` instead of `new Date()`. The dataset is now permanently self-consistent regardless of how long after generation the app actually runs — no scheduled job, no reseeding.
- Also stamped `GENERATED_AS_OF` into a new `data/seed/metadata.json` sidecar file (not a field on `properties.json` itself, so `scripts/seed.ts` and the live test's loader keep reading a plain array unchanged) — pure human traceability; the engine itself reads the value from the exported constant, never this file.
- **Proof:** 1 new test — a comp closed in 2019 (which no live "trailing 12 months" search could ever find against the real clock) is found when the provider's `getAsOfDate()` returns a 2020 reference date, proving the loop uses the provider's date, not `new Date()`.

### Step 10: PDF report (A7, A13)
- [ ] `report-document.tsx`: cover, subject, comps, adjustment grid, recommendation, rationale, methodology appendix, disclosures in the footer of every page.
- **Proof:** test renders a fixed result, extracts text with `unpdf`, and checks every section and the disclosures on every page. A visual review follows.

### Step 11: Accounts, environment and first deploy (preview only)
You complete these steps; I provide numbered instructions:
- [x] GitHub repository `khoa-ndl/cma-agent`, created and pushed with your approval — done ahead of schedule, during Step 8 (public repo, your choice).
- [x] Neon: done ahead of schedule, during Step 9's manual browser check, but **not through the Vercel Marketplace integration** this step originally planned — you created a standalone Neon project directly (console.neon.tech) so the UI check wasn't blocked on the Vercel import first. **Open decision for this step:** when importing to Vercel below, either link this existing Neon project or let Vercel provision a separate one — your call once we're there.
- [x] Local `.env` filled in: `DATABASE_URL` (the Neon project above) and `SESSION_SECRET` (generated with `openssl rand -base64 32`) — both confirmed working. `ANTHROPIC_API_KEY` was already set from Step 7's A4 approval.
- [x] Migrations applied and sample dataset seeded on Neon — done during Step 9's check; re-run once more if the dataset generator changes (e.g. the `generatedAsOf` anchor fix under discussion).
- [ ] Anthropic Console: create an API key and set the monthly spend limit (spec 7.3). **Still open** — the key currently in `.env` was provided directly, not confirmed to have a spend limit set.
- [ ] Vercel: import the repository and add the Neon integration; add `ANTHROPIC_API_KEY`, `SESSION_SECRET`, `ANTHROPIC_MODEL`.
- **Proof (A17):** `next build` has been run locally against this Neon database (Step 9) — `next start` (serving the build, not just compiling it) hasn't been run yet; do that here.
- **Proof (C3):** confirm Vercel Hobby's function duration limit, set `maxDuration`, and record it in spec C3.
- [ ] Preview deploy, only with your explicit approval.

### Step 12: Measure cost (C4) and tune
- [ ] With approval, run about 10 reports on the preview deploy. Record measured tokens and cost per report, update spec 7.2, and set the Anthropic spend limit and initial code allocations from measured data.
- [ ] Tune effort and prompt if quality or cost is off target.

### Step 13: Review (Stage 5)
- [ ] `/code-review high`, `/ponytail-review`, `/simplify` (report only), `/ponytail-debt`. Merge into one Important/Nit list for your approval.
- [ ] Review against spec acceptance criteria A1–A17; A12 (one-minute comprehension) is checked by two people unfamiliar with the product.
- [ ] Production deploy only with your explicit approval.

## Departures from spec

| Item | Change | Reason |
|---|---|---|
| `access_attempts` table | Added | Spec 8 requires rate-limited code checks; serverless functions keep no memory between requests, so attempts are stored in the database. `spec.md` 3.3 is updated in the Step 2 commit. |
| Stale-run sweep | Added | A run killed by a platform timeout would otherwise leave a `running` row that blocks the user permanently. |

## Risks

| Risk | Mitigation |
|---|---|
| Vercel Hobby function time limit shorter than an agent run | Confirm in Step 11; keep runs under 90 seconds; stale-run sweep and status polling cover interrupted runs |
| Client disconnect ends the stream mid-run | Report state is saved in the database; the page recovers by polling `GET /api/reports/[id]` |
| Synthetic data too regular or too noisy (C6) | A2 test plus visual review of sample reports in Step 5 |
| Model restates figures inaccurately (C5) | Results and PDF render engine figures only (A5) |
| Neon driver differences from PGlite in tests | The same Drizzle queries run on both; A17 and preview runs exercise Neon |
| Cost per report above estimate (C4) | Measured in Step 12 before any codes are issued |

## Verification

- `npm test`: type check, lint, and all unit and integration tests on PGlite (A1–A3, A5, A7–A11, A13–A16). Must pass before every commit.
- `npm run test:live`: A4 against the real API, with approval only.
- Manual: A6 (browser), A7 visual review, A12 (two people), A17 (`next start` locally).
- Every step's test output is shown before its commit.
