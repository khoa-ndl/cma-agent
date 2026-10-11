# Plan: Operator Dashboard

**Owner:** Khoa Nguyen, Nguyen Design Labs
**Date:** 2026-10-11
**Status:** Approved
**Sources:** [intent.md](intent.md), [spec.md](spec.md)

## Context

`intent.md` and `spec.md` are approved and committed. This plan adds one piece of scope found while planning, now folded into both: a ~90-minute **idle** session timeout for both admin and end-user sessions, plus a manual logout action for both (Step P0, below) — this changes existing end-user session behavior (currently 30 days, no logout), not just new admin-dashboard scope, so the main [../spec.md](../spec.md) also gets a one-line amendment.

No new dependencies. Reuses the existing toolchain (`docs/plan.md`'s toolchain table still applies).

Verified directly against the codebase and Next.js 16's own docs before writing this:
- `ReportView.tsx:155` hardcodes the PDF link to `/api/reports/${reportId}/pdf` — needs a `pdfHref` prop to work for `/admin/reports/[id]` too.
- `listReports` (`src/app/api/reports/logic.ts`) has no `limit` parameter yet (hardcoded `MAX_LISTED_REPORTS = 100`) — adding one is backward-compatible.
- The partial unique index `reports_one_running_per_code` (`schema.ts`) is unconditional, so two concurrent operator-generated reports would hit a real constraint violation — `createOperatorReport` must catch this explicitly.
- `middleware.ts` is deprecated in Next.js 16, renamed to `proxy.ts` (export named `proxy`, not `middleware`). No proxy file exists yet. Proxy defaults to the Node.js runtime in v16, so `node:crypto`-based token signing works there — this is what makes idle-timeout refresh possible at all, since Server Components can't set cookies (only Route Handlers and Proxy can).
- The 30-day session length is currently defined in two unlinked places (`lib/credits/session.ts`'s `MAX_AGE_MS`, `app/api/_lib/session.ts`'s `SESSION_MAX_AGE_SECONDS`) — consolidated to one source of truth while changing the value.

## Design decisions

1. Admin session signing reuses `SESSION_SECRET` — no new env var. Cross-forgery is prevented at the payload-shape level (`{kind:"admin", issuedAt}` vs `{accessCodeId, issuedAt}`), not by secret separation.
2. Admin sidebar chrome only renders once authenticated — the login screen stays bare, same posture as `/` today.
3. Admin PDF route works for any report, not just operator-generated ones — matches "admin sees everything."
4. Both session types get a ~90-minute idle timeout, refreshed via `proxy.ts` on every matched request (page navigation counts, not just API calls), plus a manual logout action.
5. Admin session/login primitives live in `src/lib/admin/` (new), not `src/lib/credits/` — keeps the end-user access-code system and the admin password system structurally separate. Admin token verify is a full independent reimplementation (not a thin wrapper); rate-limit constants are shared (imported), but query logic is duplicated per table; operator-report completion logic is not shared with the customer path. `__operator__` exclusion is centralized in one function (`listCustomerAccessCodes`) so there's exactly one place a future query could forget to filter it.

## Build steps

Each step: write tests first and confirm they fail, implement until they pass, run `npm test`, run `/ponytail-review` on the step's diff, commit, merge with approval.

### Step P0: Amend docs for the session-timeout addition — done (97eb2d9)
- [x] `intent.md`: add the session-timeout/logout requirement to "Desired outcome."
- [x] `spec.md`: add a Decisions row, a data-model note (no new table — cookie-refresh logic), and acceptance criteria D11/D12.
- [x] `../spec.md` (main): one-line amendment to §8 noting the session length change, pointing here.
- No code changes. Docs-only commit.

### Step P1: Schema + migration — `admin_login_attempts` — done (a859225)
- [x] `schema.ts`: `adminLoginAttempts` table, identical shape to `accessAttempts`.
- [x] `lib/credits/access.ts`: export `MAX_FAILED_ATTEMPTS`, `RATE_LIMIT_WINDOW_MINUTES` (currently module-private).
- [x] `lib/credits/credits.ts`: export `STALE_RUN_MINUTES` (currently module-private) — needed by the admin overview's stuck-reports query.
- [x] `npm run db:generate` → migration file.
- **Proof:** migration applies on PGlite; `npm test` passes (151 tests).

### Step P2: Consolidate session-length constants; 30 days → 90 minutes — done (20b2b27)
- [x] `lib/credits/session.ts`'s `MAX_AGE_MS` becomes the one source of truth, exported.
- [x] `app/api/_lib/session.ts`'s `SESSION_MAX_AGE_SECONDS` derives from it (`/ 1000`), not a separate literal.
- [x] Value changes to 90 minutes.
- **Proof:** drift-guard test (`SESSION_MAX_AGE_SECONDS * 1000 === MAX_AGE_MS`) plus a 90-minute-value test; existing session tests pass unchanged (153 tests).

### Step P3: Admin session token primitives — done (3f90564)
- [x] New `lib/admin/session.ts`: `createAdminSessionToken`/`verifyAdminSessionToken`, independent HMAC sign/verify, reuses the 90-minute constant from P2.
- **Proof:** round-trip, wrong secret, tampered payload/signature, malformed input, expired token; cross-check both directions (admin verify rejects access-code payload, and vice versa — D2). 161 tests.

### Step P4: Admin login — password check + rate limiting — done (5035056)
- [x] New `lib/admin/login.ts`: `checkAdminLogin`, constant-time comparison, rate-limit check before comparison (same ordering as `checkAccessCode`), records every attempt.
- **Proof:** correct/wrong password; 10 failures/15 min blocks an 11th; a different IP unaffected; cross-isolation from `access_attempts` (D10). 167 tests.

### Step P5: Route-layer admin session helper + login/logout routes — done (421b268)
- [x] New `app/api/_lib/admin-session.ts`: cookie name, `resolveAdminSession`, `requireAdminPassword`.
- [x] New `app/api/admin/session/logic.ts` + `route.ts`: `POST` login, `DELETE` logout.
- [x] `app/api/access/route.ts` gains a `DELETE` handler (end-user logout).
- **Proof:** login success/failure/rate-limited; 176 tests. Both `DELETE` handlers (D12) are trivial cookie clears with no branching logic, so — consistent with this project's existing precedent that `route.ts` files aren't separately unit-tested — they're verified in the Step P11 Playwright walkthrough instead.

### Step P6: `proxy.ts` — sliding idle-timeout refresh — done (91c3546)
- [x] New `src/proxy.ts`: reissues `cma_session`/`cma_admin_session` with a fresh `issuedAt` on every matched request if currently valid; leaves an invalid/expired cookie untouched.
- [x] `config.matcher`: `/cma/:path*`, `/admin/:path*`, `/api/:path*`.
- **Change from the original plan:** the plan assumed no stable test seam existed for proxy files. Next's own docs (and `next/experimental/testing/server`) confirm the full `proxy()` function *can* be unit-tested, but the real gap was that it needs `SESSION_SECRET` from `process.env`, with no test precedent for setting that in this suite. Resolved the same way every other route in this project resolves it: pulled the refresh logic into a plain, testable function (`api/_lib/proxy-logic.ts`, explicit `secret` parameter) and left `proxy.ts` itself as the thin, untested NextRequest/NextResponse/env wrapper. 183 tests, including a fake-timers test proving the sliding window itself (D11): a token refreshed at 89 minutes is still valid 89 minutes after *that*, well past when the original token would have expired.
- **Manual proof:** ran against the real dev server — a valid cookie gets a new `Set-Cookie` with a different token, an already-expired cookie gets nothing, no cookie gets nothing.

### Step P7: Operator sentinel + unmetered report creation — done (ada48e6)
- [x] New `lib/credits/operator.ts`: `ensureOperatorAccessCode` (lazy, idempotent), `createOperatorReport` (no `reserveCredits`, no ledger row, catches the partial-unique-index race as `already_running`).
- [x] `lib/credits/access.ts`: `OPERATOR_CODE_LABEL`, `listCustomerAccessCodes`, `issueAccessCode`, `revokeAccessCode`.
- **Change from the original plan:** `OPERATOR_CODE_LABEL` lives in `access.ts`, not `operator.ts` as first sketched — `operator.ts` needs `access.ts`'s `hashAccessCode` to compute the sentinel's deterministic `codeHash`, so defining the label in `operator.ts` would have made the two modules import each other.
- **Found while implementing:** drizzle-orm wraps the driver's unique-violation error in a `DrizzleQueryError`, with the real Postgres error (the one carrying `.code === "23505"`) nested in `.cause`, not at the top level. The first version's `catch` block checked the wrong level and let the error through uncaught; confirmed against the actual thrown error, fixed to check both.
- **Proof:** sentinel created once and reused, including under genuine `Promise.all` concurrency; operator report never changes any other code's balance (D6); no ledger row; concurrent operator reports settle to exactly one `already_running` (same proof pattern as the existing A9 concurrent-reservation test); each new `access.ts` function covered. 195 tests.

### Step P8: Admin reports routes
- [ ] New `app/api/admin/reports/logic.ts` + `route.ts`: `listAllReports` (unscoped, sentinel labeled "Operator", capped at 200), `handleCreateOperatorReport`/`streamOperatorReport` (SSE, same shape as `/api/reports`).
- [ ] New `app/api/admin/reports/[id]/logic.ts` + `route.ts`, and `.../pdf/logic.ts` + `route.ts`.
- **Proof:** unauthenticated 401 on every route; operator POST streams and persists correctly with no change to any customer balance; list shows both operator and customer reports correctly labeled; row cap; status/PDF mirror the existing report routes minus ownership scoping.

### Step P9: Admin codes routes
- [ ] New `app/api/admin/codes/logic.ts` + `route.ts`: list, issue.
- [ ] New `app/api/admin/codes/[id]/revoke/logic.ts` + `route.ts`.
- **Proof:** unauthenticated 401; list excludes the sentinel (D5); issuing works end to end with a real login (D3); revoking blocks a new report and a stale session (D4).

### Step P10: Admin overview route
- [ ] New `app/api/admin/overview/logic.ts` + `route.ts`: health, stuck-running reports (using `STALE_RUN_MINUTES` from P1), monthly spend across all reports including the operator sentinel (D7), low-balance customer codes.
- **Proof:** unauthenticated 401; stuck report appears with age + code label; spend sums customer + operator together; low-balance list excludes the sentinel.

### Step P11: Admin UI
- [ ] New `AdminLoginForm.tsx`; modified `NewCmaForm.tsx` (`endpoint`/`resultBasePath`/`unmetered` props), `ReportView.tsx` (`pdfHref` prop).
- [ ] New `app/admin/layout.tsx` (sidebar, authenticated-only) and pages: `page.tsx`, `codes/page.tsx`, `reports/page.tsx`, `new/page.tsx`, `reports/[id]/page.tsx`.
- [ ] `app/cma/layout.tsx` gains a "Log out" nav item.
- **Proof:** no new unit tests (Server Component pages aren't unit-tested in this codebase, same precedent as `/cma/*`). `next build` succeeds. Full Playwright walkthrough: wrong password rejected + rate-limited; correct password reaches Overview; issue a code, log in as that end user; revoke it, confirm the end-user session is bounced; generate an operator CMA, confirm its PDF and zero balance impact; Overview reflects the spend; both logout buttons work; session cookie visibly refreshes on activity and expires after ~90 idle minutes (verified via a shortened constant or a pre-expired token, not a real 90-minute wait).

### Step P12: End-user home page
- [ ] `listReports` gains an optional `limit` parameter (default unchanged, backward compatible).
- [ ] New `app/cma/page.tsx`: balance + 5 recent reports + "Start new CMA."
- [ ] `cma/layout.tsx` gets "Home" as the first nav item; `/` and `AccessForm.tsx` redirect to `/cma` instead of `/cma/new`.
- **Proof:** `limit` test; manual check — login lands on `/cma` with real data (D8), `/` redirects an already-logged-in visitor, sidebar shows "Home" first.

### Step P13: Review
- [ ] `/code-review high`, `/ponytail-review`, `/simplify` (report only) on the full diff.
- [ ] Re-check D1–D12 against their tests/manual walkthroughs.
- [ ] Push a branch, check the Vercel preview, merge only with explicit approval.

## Risks

| Risk | Mitigation |
|---|---|
| A new customer-facing query forgets to exclude the operator sentinel | Centralized in `listCustomerAccessCodes`; grep for `'__operator__'` at review time — should appear in exactly two places |
| Two overlapping admin "New CMA" submissions hit the partial unique index | Handled explicitly in `createOperatorReport`, with its own test |
| `proxy.ts` silently fails to refresh (wrong matcher, wrong cookie name) | Manual check reads the actual `Set-Cookie` header, not just "no error" |
| Reusing `SESSION_SECRET` for admin sessions | Deliberate trade-off — cheap to split later if ever needed |
| Shortening session length retroactively affects anyone already logged in | One-time transition effect, not a bug; stateless cookies need no data migration |

## Verification

1. `npm test` green throughout (every step).
2. `next build` succeeds after P11/P12.
3. Full Playwright walkthrough (P11) against a real Neon database.
4. Vercel preview checked before merging to `main`.
