# Intent: CMA Agent

**Owner:** Khoa Nguyen, Nguyen Design Labs
**Date:** 2026-10-10
**Status:** Approved

## Problem

Residential real estate agents spend hours building each comparative market analysis (CMA). They pull recent sales and active listings, pick comparable properties, adjust for differences, settle on a price range, and format a client-ready report. The process is repetitive, but each step takes judgment. That combination makes it a strong fit for an AI agent that can retrieve data, reason over it and produce documents.

## Purpose

CMA Agent is a reference implementation from Nguyen Design Labs. It shows the full agentic pattern behind a production real estate tool, **data retrieval → reasoning → report generation**, running end to end on realistic market data. It serves as a live demonstration for prospective clients and as the architectural foundation for client engagements, including a planned commercial real estate variant.

## Desired outcome

A live web application where a qualified prospect can:

1. Enter a subject property in the Greater Seattle metro area
2. Watch the agent work as it selects comparable sales and active listings, applies adjustments, and states its reasoning
3. Receive a pricing recommendation (a value range and a suggested list price) with supporting rationale
4. Download a professional PDF CMA report
5. (Release 2) Refine the analysis in conversation, e.g. "limit comps to sales in the last 90 days"

### Success criteria
- A prospect can use the application on their own and understand what it does within one minute
- Every architectural component is documented: data model, agent loop, tools, cost model, and the MLS integration path
- Operating costs stay under $50/month, controlled through per-user credit allocations set by the operator

## Stakeholders

- **Demo users:** residential agents, brokers and other real estate professionals evaluating Nguyen Design Labs
- **Operator (Nguyen Design Labs):** approves access requests, monitors usage and cost, and uses the application in client discovery
- **Future clients:** brokerages that commission a production deployment connected to their MLS feed

## Scope

### Release 1: initial launch (target: within days)
- **Sample dataset** for the Greater Seattle metro: real neighborhoods and cities (e.g. Ballard, Capitol Hill, Bellevue, Kirkland, Redmond), synthetic addresses, market-realistic pricing. It conforms to the **RESO Data Dictionary** (field names, enumerations and statuses) so it is structurally equivalent to an MLS feed
- **Data provider abstraction:** the agent reads data through a single interface, and the sample dataset is one implementation. A RESO Web API (MLS) provider can be added without changes to the agent, the analysis logic or the reports
- **CMA agent** built on the Claude API, with tools for comp search, filtering, adjustment and pricing
- **Web interface:** subject property input, real-time progress as the agent works, results view
- **PDF report** generation
- **Per-user access codes:** each code is issued by the operator to one user and carries its own credit allocation
- **Usage credits:** every report and chat message draws down the user's balance; usage stops when the balance is exhausted. Total spend is therefore bounded by the credits the operator has issued
- **One active report per user:** a user cannot start a new report while one is in progress
- **Provider-side safeguard:** a monthly spend limit configured in the Anthropic Console, as protection against faults (e.g. runaway agent loops or a compromised key), separate from the credit system
- **Disclosures** on the application and every report: "Sample data, not real listings" and "For demonstration only; not an appraisal or professional advice"

### Release 2: access management and refinement (target: 1–2 weeks after Release 1)
- **Request Access** workflow: a prospect submits a form, the operator is notified at `khoa@nguyendesignlabs.com` and approves manually, and the prospect receives sign-in access
- **User accounts** (Supabase Auth is the leading option)
- **Credit allocation at approval:** the operator sets each user's credit balance when approving them (default roughly equivalent to 5 reports and 20 chat messages), and can grant more
- **Conversational refinement** of an existing analysis
- Refinements based on Release 1 usage

### Deferred to a production deployment
These are required for a client-facing production system and are out of scope for this implementation:
- Live MLS data: licensed agent or broker sponsorship, an MLS data license agreement, and a RESO Web API provider
- Brokerage branding and white-labeled reports
- Billing and subscription management
- Multi-tenant organizations and roles (broker, agent, admin)
- MLS display compliance (IDX/VOW rules, attribution, data refresh requirements)
- Review by a licensed professional and legal review of disclosures
- Uptime, monitoring and support SLAs
- Data retention and privacy policy

### Out of scope
- **Commercial real estate (CRE).** It relies on income-based valuation (NOI, cap rates, rent rolls) with different data, tools and reports, and is planned as a separate project built on this architecture
- Model training or fine-tuning. Domain behavior comes from data, tools and instructions
- Appraisals or other official valuations

## Constraints

- **Budget:** under $50/month total (Claude API, data, hosting, email)
- **Schedule:** Release 1 within days; Release 2 within 1–2 weeks after
- **Transparency:** architecture and design decisions are documented so the system can be audited, explained and extended
- **Compliance:** synthetic data only, clearly labeled; never presented as an appraisal or professional advice
- **Technology:** confirmed in the spec. Leading option: Next.js on Vercel, Supabase for auth and data, Claude API for the agent

## Open questions

1. **Technology stack:** confirm in the spec
2. **Cost per report:** estimate token usage per run and choose models (e.g. Sonnet for analysis, Haiku for lightweight steps) to fit the budget and set credit pricing
3. **Subject property inputs:** address only, or also beds, baths, living area and condition?
4. **Comp selection and adjustment method:** criteria (radius, date range, size band) and how adjustments are calculated: deterministic code, model judgment, or a hybrid
5. **Sample dataset size:** the number of properties and neighborhoods needed for credible results
6. **PDF generation approach:** HTML-to-PDF rendering or a PDF library
7. **Email provider** for access notifications in Release 2 (e.g. Resend)
8. **Credit model:** the value of one credit (fixed per action, or metered on actual token cost), the default allocation, and how a run's cost is settled against the balance (simplified by the one-active-report rule)
9. **Interim data source:** whether to add a commercial property-data API before MLS integration (deferred; pricing to be evaluated)
