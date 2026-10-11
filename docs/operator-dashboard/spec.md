# Spec: Operator Dashboard

**Owner:** Khoa Nguyen, Nguyen Design Labs
**Date:** 2026-10-11
**Status:** Draft — awaiting your review
**Source:** [intent.md](intent.md)

## 1. Decisions

| Area | Decision | Rationale |
|---|---|---|
| Admin authentication | Single `ADMIN_PASSWORD` env var, HMAC-signed session cookie — same primitive as the end-user session (`lib/credits/session.ts`), new cookie name (`cma_admin_session`) and a structurally distinct payload (`{ kind: "admin", issuedAt }`, no `accessCodeId`) | Matches Release 1's "no auth library" constraint; the distinct `kind` field and separate cookie name mean an end-user session token can never be mistaken for an admin one, or vice versa, even if someone tried |
| Admin login rate limiting | A dedicated `admin_login_attempts` table (same shape and logic as `access_attempts`: per-IP, 10 failed attempts / 15 minutes), not a shared counter with end-user code attempts | A dedicated table avoids an attacker hammering the admin login from locking out a real customer behind the same IP (e.g. shared office network), and vice versa — the two failure modes shouldn't affect each other's budget |
| Operator-generated reports | Attached to one reserved, hidden access code (label `__operator__`, auto-created on first use, excluded from every customer-facing list), but **never go through `reserveCredits`** — a dedicated path inserts the report row directly with no balance deduction and no ledger entry | Keeps `reports.access_code_id` `NOT NULL` with no schema migration; "excluded from every customer list" is enforced by always filtering `label != '__operator__'` in customer-facing queries, not by a new column |
| Revoking a code | One-way. No "un-revoke." | Matches Release 1's lean, no-self-service posture (spec 8's existing design intent) — issuing a fresh code is one action away, and avoids a reactivation flow nobody asked for. **Flagged for your confirmation in §11.** |
| End-user home page | New page at `/cma` (the bare `/cma/*` index) — balance, 5 most recent reports, a "Start new CMA" action. `/` now redirects a signed-in session to `/cma` instead of `/cma/new`. | `/cma/new` keeps its own URL and behavior unchanged; `/cma` becomes the natural post-login landing spot, consistent with how `/cma/new` and `/cma/reports` are already named |
| Admin CMA generation | Reuses the existing `NewCmaForm`/SSE/`ReportDocument` machinery end to end — same component, different data-fetch path for credits (admin has none to check) and a different POST target | No new PDF or agent-loop code; only the reservation step differs |
| Session timeout | Both admin and end-user sessions get a ~90-minute **idle** timeout (not a fixed lifetime) via a `proxy.ts` file (Next.js 16's renamed `middleware.ts`) that reissues a still-valid session cookie with a fresh `issuedAt` on every matched request; an already-expired or missing cookie is left untouched. Both session types also get a manual logout (clears the cookie immediately). | Server Components can't set cookies, only Route Handlers and Proxy can — so "idle" (resets on page views, not just API calls) requires intercepting every request. Replaces the current 30-day fixed expiry with no logout at all, which was never a deliberate security decision, just what Release 1 needed to ship. |

## 2. Architecture

```
/admin (new, password-gated)
   ├── Login                          -> POST /api/admin/session
   ├── Overview                       -> GET /api/admin/overview (health, spend, low-balance codes)
   ├── Codes                          -> GET/POST /api/admin/codes, POST /api/admin/codes/[id]/revoke
   ├── Reports & costs                -> GET /api/admin/reports
   └── New CMA (operator, unmetered)  -> POST /api/admin/reports (SSE, same shape as POST /api/reports)
                                           -> GET /api/admin/reports/[id]/pdf

/cma/* (existing, access-code-gated)
   └── Home (new)                     -> reuses listReports + getAccessCodeStatus, no new route needed
```

Both admin and end-user sessions are HMAC-signed cookies verified the same way (`verifySessionToken`-style), but with different secrets-of-trust: an admin session proves "knows `ADMIN_PASSWORD`," an end-user session proves "has a valid, unrevoked access code." Neither can be forged into the other.

## 3. Data model

One new table:

- `admin_login_attempts` — `id`, `ip_address`, `succeeded`, `created_at`. Identical shape and rate-limit logic to `access_attempts` (spec.md §3.3, Step 6's departure note), kept separate so admin-login and end-user-code failures don't share a rate-limit budget (see Decisions above).

One behavioral rule, enforced in query code, not the schema:

- A row in `access_codes` with `label = '__operator__'` is the single reserved system code for unmetered operator reports. Every customer-facing query (the end-user's own `listReports`, the admin's codes list, the admin's "all reports" list's cost-per-customer breakdown) excludes it; the admin's "all reports" list and the health screen's monthly-spend total **include** it, since real API cost was still incurred.
- Created lazily: the first operator-generated report looks for this code, creates it with a placeholder hash and `credits_balance = 0` if missing, and skips the balance check entirely for this one code's reports (the whole point is it's never charged).

No new table for session timeout — it's cookie-refresh logic, not server-side session storage. The existing signed-cookie approach (`lib/credits/session.ts`) stays; only its expiry length changes (30 days → 90 minutes) and a `proxy.ts` file is added to slide that expiry forward on activity.

## 4. Screens

### Operator (`/admin`, all require the admin session)

1. **Login** (`/admin`, unauthenticated state): a password field. Wrong password shows an error; rate-limited per IP (10 failed attempts / 15 minutes), same pattern and threshold as the end-user access-code check.
2. **Overview** (`/admin`, authenticated state): database reachability (reuses `checkHealth`), count of reports currently stuck in `running` past the stale threshold (list, not just a count — report id, code label, how long it's been running), total spend this calendar month, and codes with balance below one report's cost (5 credits).
3. **Codes** (`/admin/codes`): every access code (label, balance, created date, revoked status) excluding the operator sentinel; a form to issue a new one (label + credits, same as `codes:issue`); a revoke action per row.
4. **Reports & costs** (`/admin/reports`): every report (operator's included, clearly labeled "Operator" instead of a code label), status, tokens, cost, created/finished timestamps, newest first, capped at the most recent 200.
5. **New CMA** (`/admin/new`): the same form end users see, minus any credit-balance messaging — submitting always succeeds (no "insufficient credits" path), generates a report attached to the operator sentinel, and the resulting page offers the same PDF download.

### End user (existing `/cma/*` sidebar, new first item)

6. **Home** (`/cma`): credit balance, the 5 most recent reports (address, status, date — links to each), and a "Start new CMA" button to `/cma/new`. Sidebar gains this as its first nav item, above "New CMA".

Disclosures (spec.md §5's "Sample data, not real listings" / "For demonstration only…") continue to appear on every page via the root layout — unaffected by this feature, but `/admin/*` pages get them too for consistency, even though the operator already knows.

## 5. Security and privacy

- `ADMIN_PASSWORD` is a plain shared secret (not hashed, since it's a single operator credential set directly in Vercel's environment variables, never transmitted anywhere except the login POST over HTTPS) — compared with a constant-time check, same as the session-cookie signature comparison already in `session.ts`.
- The login is rate-limited per IP before the password comparison even runs (same ordering as the end-user check in `access.ts`, so a locked-out IP can't use repeated guesses to fish for anything).
- The admin session cookie is `httpOnly`, `secure`, `sameSite: "lax"`, same posture as the end-user cookie.
- Every `/api/admin/*` route re-checks the admin session itself (never trusts the UI alone) — same rule spec.md §8 already states for the end-user API.
- The operator's own generated reports are real data in the real `reports` table — nothing about them is hidden from the database itself, only from customer-facing UI and customer-facing aggregates.

## 6. Acceptance criteria

| # | Requirement | Verified by |
|---|---|---|
| D1 | A wrong admin password is rejected; a correct one sets a working session | Route test with the PGlite fixture, no real password in test fixtures |
| D2 | An admin session cookie never authenticates an end-user route, and vice versa | Test asserting `verifySessionToken` rejects an admin-shaped payload and `verifyAdminSessionToken` rejects an access-code-shaped one |
| D3 | Issuing a code from `/admin/codes` produces a working code (same as the CLI script) | Integration test: issue via the new route, then log in as an end user with it |
| D4 | Revoking a code immediately blocks that code from starting a new report or (per the Step 11 fix) leaving a stale session half-logged-in | Reuses the existing revoked-code test pattern from `access.test.ts` |
| D5 | The "all reports" list and the codes list never show the `__operator__` sentinel as a customer code | Test asserting the sentinel is excluded from both list queries |
| D6 | An operator-generated report never changes any real customer access code's `credits_balance` | Test: generate an operator report, assert every customer code's balance is unchanged |
| D7 | The monthly spend total includes operator-generated report costs | Test: operator report with a known cost contributes to the aggregate |
| D8 | The end-user home page shows the real current balance and real recent reports, not stale/cached data | Reuses `getAccessCodeStatus` and `listReports` directly — same proof pattern as `/cma/new` and `/cma/reports` already use |
| D9 | Every `/admin/*` page and API route rejects a request with no admin session, or an end-user session, with 401 | Route tests, one per endpoint, consistent with the existing reports/addresses route test pattern |
| D10 | 10 failed admin login attempts from one IP within 15 minutes blocks an 11th, independent of end-user access-code rate limiting | Reuses the `isRateLimited` test pattern from `access.test.ts`, against the new table |
| D11 | A session cookie (admin or end user) is reissued with a fresh expiry on activity, and a session left untouched for ~90 minutes is no longer valid | Manual/Playwright check (no stable unit-test seam for `proxy.ts` yet) — inspects the `Set-Cookie` header after a request, and a deliberately-expired token is rejected |
| D12 | A manual logout (admin or end user) clears that session's cookie immediately — the next request isn't authenticated | Route test: `DELETE` on the session route, then a follow-up request with the same (now-cleared) cookie is rejected |

## 7. Concerns for review

| # | Concern | Recommendation |
|---|---|---|
| DC1 | ~~No rate limiting on admin login~~ | **Resolved:** dedicated `admin_login_attempts` table, same pattern as end-user codes (D10). |
| DC2 | `ADMIN_PASSWORD` as a single, never-rotated, plaintext-in-env-vars secret has no recovery story if it leaks — unlike access codes, which can be revoked and reissued per-recipient. | Acceptable for a single-operator Release 1 tool; rotating it is just changing the Vercel env var and redeploying. Worth revisiting if this ever becomes multi-operator (natural point to adopt Better Auth, already earmarked for Release 2 end-user accounts). |
| DC3 | The reserved `__operator__` code is a real row in `access_codes` — if the exclusion filter (`label != '__operator__'`) is ever missed in a new customer-facing query, operator activity would leak into a customer's view. | Centralize the filter in one place (e.g., a `listCustomerAccessCodes` wrapper that always applies it) rather than repeating the literal string in every query site. |
| DC4 | The "all reports" list (D requirement, §4 screen 4) will grow without bound over time; 200-row cap is arbitrary. | Fine for Release 1's expected volume (spec 7.3: ~200 reports/month at full budget). Revisit with real pagination if usage grows past that. |

Flag anything you want changed, then I'll write `plan.md` in plan mode.
