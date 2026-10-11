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

### Step 6: Access, sessions and credits (A8, A9, A10)
- [ ] `access.ts`: random high-entropy codes; stored as SHA-256 hashes, which are sufficient for random codes and need no password-hashing library; revocation check; failed attempts rate-limited per IP through `access_attempts`.
- [ ] `session.ts`: HTTP-only cookie signed with HMAC (Node `crypto`).
- [ ] `credits.ts`: **reserve** = one SQL statement that deducts 5 credits only if the balance allows, inserts the `running` report and writes the ledger entry. A single statement is atomic on any Postgres driver, including Neon's HTTP mode. **Refund** on system failure. **Stale-run sweep:** before a new reservation, `running` reports older than the function time limit are marked `failed` and refunded, so a crashed run cannot block a user permanently.
- [ ] `scripts/issue-code.ts` (`npm run codes:issue -- --label "…" --credits 45`): prints the plain code once.
- **Proof:** A8 (deduct and refund), A9 (second concurrent report rejected and balance unchanged), A10 (insufficient balance, revoked code), rate limit, stale sweep, cookie tamper rejection.

### Step 7: Agent (A5, A11, A14; A4 live)
- [ ] `model-client.ts`: the only file that imports the Anthropic SDK (swap point for Bedrock, Vertex or Foundry). Model ID from `ANTHROPIC_MODEL`.
- [ ] `tools.ts`: `search_comps`, `compute_adjustments`, `compute_price_range`, `submit_cma`, with strict schemas validated by zod before execution.
- [ ] `loop.ts`: manual tool loop with streaming. Emits typed progress events. Prompt caching on system prompt and tools. Adaptive thinking, effort `medium`. Handles `refusal` and `max_tokens`. Maximum 10 turns and a token ceiling. Records usage and cost on the report.
- [ ] `tool_choice` stays `auto` (Sonnet 5.5 rejects forced tool use); the prompt instructs Claude to finish with `submit_cma`.
- [ ] Anthropic's server-side refusal fallback (`fallbacks: "default"`) is enabled per current Anthropic guidance for Sonnet 5.5; it can be removed if unwanted.
- **Proof, with a scripted fake model client (no API cost):** A5 (result figures equal engine outputs), A11 (a model that never finishes stops at the turn ceiling, report `failed`, credits refunded), A14 (usage and cost recorded).
- **Live proof (A4):** `npm run test:live` runs 3 fixed subjects against the real API, about $0.50 in total. Run only with explicit approval.

### Step 8: API routes (A6, A15)
- [ ] `POST /api/access`: validate code, set session cookie.
- [ ] `GET /api/addresses?q=`: autocomplete.
- [ ] `POST /api/reports`: validate subject facts, reserve credits, run the agent, stream progress as server-sent events.
- [ ] `GET /api/reports/[id]`: status and result, used to recover after a dropped connection.
- [ ] `GET /api/reports/[id]/pdf`: renders the PDF (Step 10).
- [ ] `GET /api/health`: database round trip; 200 or 503 (A15).
- **Proof:** route tests with the fake model client: SSE events arrive in order; unauthenticated requests rejected; health returns 503 when the database is unavailable.

### Step 9: User interface (A6, A13)
- [ ] `/`: product description, disclosures, code entry.
- [ ] `/cma/new`: address autocomplete, pre-filled editable facts, credit balance.
- [ ] `/cma/[id]`: live progress feed, then results (comps table, adjustment grid, range, rationale, excluded comps, PDF button). Falls back to polling the report if the stream drops.
- [ ] Disclosures in the root layout so they appear on every page.
- **Proof:** a test renders each page and checks the disclosures (A13). **Manual browser check with numbered steps for you (A6):** progress appears before completion.

### Step 10: PDF report (A7, A13)
- [ ] `report-document.tsx`: cover, subject, comps, adjustment grid, recommendation, rationale, methodology appendix, disclosures in the footer of every page.
- **Proof:** test renders a fixed result, extracts text with `unpdf`, and checks every section and the disclosures on every page. A visual review follows.

### Step 11: Accounts, environment and first deploy (preview only)
You complete these steps; I provide numbered instructions:
- [ ] Anthropic Console: create an API key and set the monthly spend limit (spec 7.3).
- [ ] GitHub repository `khoa-ndl/cma-agent`, created and pushed only with your approval.
- [ ] Vercel: import the repository and add the Neon integration (creates `DATABASE_URL`); add `ANTHROPIC_API_KEY`, `SESSION_SECRET`, `ANTHROPIC_MODEL`.
- [ ] Local `.env` copied from `.env.example`, pointing to a Neon development branch.
- [ ] Run migrations and seed on Neon.
- **Proof (A17):** `next build` and `next start` run locally against the Neon development branch, outside Vercel.
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
