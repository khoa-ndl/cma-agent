# CMA Agent

A reference implementation from Nguyen Design Labs: an AI agent that produces a residential comparative market analysis (CMA). It retrieves comparable sales, applies documented price adjustments, recommends a value range and list price with its reasoning, and generates a PDF report.

Release 1 runs on synthetic Greater Seattle market data that follows the RESO Data Dictionary. **Sample data, not real listings. For demonstration only; not an appraisal or professional advice.**

- **Build Map (private):** https://claude.ai/artifact/TKZymk9Gnot8GDZ29kSiU6. Access is by invitation.
- **Design documents:** [intent](docs/intent.md), [spec](docs/spec.md), [plan](docs/plan.md)

## Stack

Next.js 16 (TypeScript) on Vercel · Neon Postgres via Drizzle ORM · Claude Sonnet 5.5 via the Anthropic TypeScript SDK · `@react-pdf/renderer`. Each external service sits behind one module and can be replaced; see spec section 2.1.

## Getting started

Requires Node.js 24 or later.

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:3000
```

## Commands

| Command | Purpose |
|---|---|
| `npm test` | All checks: type check, lint and tests. Must pass before every commit. |
| `npm run test:live` | Tests that call the paid Anthropic API. Run deliberately. |
| `npm run dev` | Local development server |
| `npm run build` | Production build |

## Author

Khoa Nguyen, Nguyen Design Labs · khoa@nguyendesignlabs.com
