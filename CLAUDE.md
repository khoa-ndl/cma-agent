# CMA Agent: project instructions

@AGENTS.md

## Commands
- `npm test`: type check (`next typegen && tsc`), lint, then vitest. Run before every commit; it must pass.
- `npm run test:live`: paid Anthropic API tests (`tests/live/`). Only with the operator's explicit approval.
- `npm run dev` / `npm run build`

## Conventions
- Process: docs/intent.md → spec.md → plan.md. Work through plan.md in order, test first, and commit at each step. Update plan.md in the same commit if the build departs from it.
- Each external service has one swap-point module (spec 2.1). Application code never imports a vendor SDK directly.
- The model never produces dollar figures. All numbers come from the analysis engine (spec 4.1, A5).
- Tests use PGlite (in-process Postgres); there is no local Postgres or Docker on this machine.
- Secrets live only in `.env` (never read or edited by Claude). Names are listed in `.env.example`.
- Build Map: https://claude.ai/artifact/TKZymk9Gnot8GDZ29kSiU6. Update its `steps`, `components` and `meta/project` data at every milestone commit.
- Explain every command in plain English before running it. File edits in this repo go through Bash. The VS Code diff approval has been unreliable.
