# CMA Agent: project instructions

@AGENTS.md

## Commands
- `npm test`: type check (`next typegen && tsc`), lint, then vitest. Run before every commit; it must pass.
- `npm run test:live`: paid Anthropic API tests (`tests/live/`). Only with the operator's explicit approval.
- `npm run dev` / `npm run build`
- `npm run db:generate` / `npm run db:migrate`: generate/apply Drizzle SQL migrations.
- `npm run db:seed`: load `data/seed/properties.json` into the database at `DATABASE_URL`.
- `npm run data:generate`: regenerate the sample dataset — writes `data/seed/properties.json` and `data/seed/metadata.json`. Deterministic; re-running without changing `generator.ts` produces a byte-identical `properties.json`.
- `npm run codes:issue -- --label "…" --credits 45`: issue a new access code (prints the plain code once, never stored).
- `db:seed`, `codes:issue` and `test:live` all need real `.env` values at runtime, but plain `tsx`/`node` don't auto-load `.env` (only `next` and `drizzle-kit` do) — each of these scripts is already wrapped with `node --env-file=.env` in `package.json`, so just use `npm run <script>`; don't invoke the underlying `tsx scripts/*.ts` directly.

## Conventions
- Process: docs/intent.md → spec.md → plan.md. Work through plan.md in order, test first, and commit at each step. Update plan.md in the same commit if the build departs from it.
- Each external service has one swap-point module (spec 2.1). Application code never imports a vendor SDK directly.
- The model never produces dollar figures. All numbers come from the analysis engine (spec 4.1, A5).
- Tests use PGlite (in-process Postgres); there is no local Postgres or Docker on this machine.
- Secrets live only in `.env` (never read or edited by Claude). Names are listed in `.env.example`.
- Build Map: https://claude.ai/artifact/TKZymk9Gnot8GDZ29kSiU6. Update its `steps`, `components` and `meta/project` data at every milestone commit — this was missed for Steps 8–9 and caught late; don't let it lag again.
- Explain every command in plain English before running it.
- Permissions: `.claude/settings.json` sets `defaultMode: acceptEdits` and allowlists routine git/npm mechanics (add, commit, checkout, ff-only merge, build, dev, db:migrate, db:seed, plus read-only commands) — these don't need individual approval. Still asks for: `git push`, installing software, deploying, destructive git operations, and anything that spends money (`test:live`, `codes:issue`).
