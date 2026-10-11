# Intent: Operator Dashboard

**Owner:** Khoa Nguyen, Nguyen Design Labs
**Date:** 2026-10-11
**Status:** Draft — awaiting your review
**Parent:** [../intent.md](../intent.md), [../spec.md](../spec.md)

## Problem

CMA Agent (Release 1) has a full end-user flow (access code entry, new CMA, live progress, results, PDF, report history) built in Steps 9–10, plus a sidebar feature for navigating between end-user views. But there is no way for the **operator** (Khoa) to see or control the product as a whole — every operator action today means asking Claude Code to run a script or a raw query:

- Issuing a new access code: `npm run codes:issue`.
- Checking who has how many credits, or which codes exist at all: no view; only ad hoc database queries.
- Revoking a code: **doesn't exist anywhere**, not even as a script. The `revoked_at` column and all the enforcement logic (access checks, the redirect-loop fix) already exist and are tested — there's just no way to actually set it.
- Seeing all reports across all users, their status, and their token usage/cost: no view; only ad hoc queries against the `reports` table.
- Confirming the database is healthy: `/api/health` exists, but it's an unauthenticated JSON endpoint, not something built for a human to check.

This is a real operational gap, not a cosmetic one — spec 7.3's budget rule ("the sum of outstanding credits × cost per credit stays within the monthly API budget") currently requires Khoa to ask Claude Code to compute it by hand.

## Desired outcome

A password-protected `/admin` area where Khoa can, without touching a terminal:

1. **See and manage access codes** — list every code with its label, balance, and status; issue a new code (replacing `npm run codes:issue`); revoke a code (new capability).
2. **See all reports and costs** — every report across every code, with status, token usage, and cost, so spend against the budget is visible at a glance instead of computed by hand.
3. **See system health** — whether the database is reachable, and which reports (if any) are currently stuck in `running` status waiting for the next stale-sweep.
4. **Generate a CMA (and its PDF) directly from the dashboard** — the same engine and agent run as the end-user flow, but the run must not deduct from, or be attributed to, any customer's access code or credit balance. (Still costs real Anthropic API money — just not tracked against a customer's credits. How this is represented in the `reports`/credit-ledger schema — e.g. a reserved system-only access code vs. a schema change — is a `spec.md`/`plan.md` decision, not fixed here.)

A second, related piece: the **end-user experience** gets a real landing page. Today, logging in goes straight to the New CMA form with no overview. Add a home view (reachable from the existing sidebar) showing: credit balance prominently, a summary of recent reports, and a clear "Start new CMA" action — giving end users the same "see everything at a glance" benefit the operator dashboard is being built for, not just the operator.

## Who and what it affects

- **Khoa**, as the sole operator — the only person who will ever use this. No multi-operator or role concept needed.
- **New auth surface:** a single admin credential, entirely separate from the end-user access-code session system (spec 6, 8) — an admin session must never be mistaken for or grant access-code-level permissions, and vice versa.
- **Existing backend:** mostly additive. The only new backend *capability* is revocation (setting `revoked_at`) — everything else (listing codes, listing reports, health) already has the data and mostly the query logic (`listReports`, `getAccessCodeStatus`, `checkHealth`) to extend or reuse.
- **End users:** gain one new page (a landing/home view), reached from the existing sidebar — `/cma/new`, `/cma/[id]`, `/cma/reports` are otherwise unchanged. The agent/engine itself isn't touched by any of this.

## Out of scope (for this round)

- Analytics or charts (trend lines, usage over time) — just current-state lists and totals.
- Editing or deleting reports.
- Any self-service signup — codes are still operator-issued only.
- Multi-operator accounts, roles, or permissions.
- Email notifications (e.g. "code running low").

## Constraints

- Matches Release 1's existing lean/no-framework approach: a single `ADMIN_PASSWORD` env var and a signed session cookie (the same HMAC-cookie pattern already built for end-user sessions), not a new auth library.
- Same design system already established (`design-system/cma-agent/MASTER.md`) and the same test-first, one-branch-per-step build discipline as every other step.
- No new paid dependencies or external services.

## Resolved decisions (my recommendation, applied — flag if you want it different)

1. `ADMIN_PASSWORD` gates the new `/admin` UI only. `/api/health` stays as is, unauthenticated — Vercel/uptime monitors need to hit it without a password.
2. "Stuck reports" in the system-health view are list-only for now, not a manual "sweep now" button. The automatic sweep already runs before every reservation, so a manual trigger isn't load-bearing — just a possible future nice-to-have.
3. The health/overview screen also surfaces total spend this month (sum of `cost_usd` across reports) and codes with low balances (below one report's cost) — both cheap to compute from data the dashboard already needs to load, and directly useful for the spec 7.3 budget rule.

Let me know what to correct — then I'll write `spec.md`.
