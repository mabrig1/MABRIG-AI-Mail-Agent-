# MABRIG AI Mail Agent

**MABRIG AI Mail Agent** is the intelligent operations layer for MABRIG Mail. It is designed to sit in front of a self-hosted mail platform such as BillionMail and provide inbox assistance, campaign intelligence, deliverability diagnostics and safe operational guidance without giving an AI model unrestricted access to SMTP credentials.

## Current agents

- **Inbox Triage** — summarises incoming messages, extracts actions and highlights urgency.
- **Reply & Compose** — creates fact-preserving drafts while keeping sending under human control.
- **Campaign Coach** — produces segmentation, subject-line, copy, CTA and measurement plans.
- **Deliverability Guardian** — diagnoses SPF, DKIM, DMARC, PTR/rDNS, reputation, list and content issues.
- **Mail-Server Operator** — explains likely server problems and proposes minimum-risk diagnostics.
- **Email Forwarding Agent** — reviews a message against an explicitly supplied destination, drafts a forwarding note and flags privacy/confidentiality risks.
- **Forwarding Rule Planner** — designs conservative recurring forwarding rules with exclusions, loop prevention and test steps.
- **Business Promotion Strategist** — turns a business objective into positioning, offers, segments, promotion sequences, calls to action and measurable campaign goals.
- **Growth Intelligence Agent** — identifies acquisition, activation, conversion, retention, referral and reactivation opportunities and proposes measurable experiments.
- **Lifecycle Journey Architect** — builds permission-based prospect, onboarding, repeat-purchase, referral, loyalty and win-back journeys.
- **Sales Opportunity Agent** — converts supplied engagement signals into a transparent opportunity assessment and next-best-action recommendation.

## Business Growth OS — beyond traditional mail

MABRIG is designed to do business work that a conventional mailbox does not perform:

- **Goal-to-growth planning** — start with a business objective instead of an email subject line.
- **Offer and positioning strategy** — turn a product/service into a clearer promotional proposition and CTA.
- **AI audience strategy** — suggest useful segments and message angles from the supplied business context.
- **Lifecycle journey design** — orchestrate prospect, conversion, onboarding, repeat purchase, referral, loyalty and win-back stages.
- **Growth experiment planning** — propose acquisition, conversion, retention and referral experiments and state the metric each should influence.
- **Lead opportunity scoring** — combine explicit engagement signals into a transparent deterministic score, then ask AI for the next best action.
- **Referral, upsell and reactivation thinking** — treat existing customers as a growth channel instead of focusing only on one-time broadcasts.
- **Local-market promotion** — include a market/location in the growth brief for locally relevant promotion ideas.
- **Campaign approval workflow** — convert a generated growth plan into a signed `create_campaign` proposal while keeping external execution under human control.
- **Mail + business intelligence in one workspace** — forwarding, deliverability and server operations live beside promotion and revenue workflows.

The lead score does not infer protected traits, wealth, or hidden intent. It uses only explicit business-interaction signals supplied to the system, and the scoring reasons are shown to the administrator.

## Safety model

The current release runs in **approval-controlled mode**. AI output can recommend or draft actions and signed action proposals expire after 15 minutes. Verified forwarding-rule operations and journey-backed Growth Autopilot campaigns have real BillionMail executors, and both executors are disabled by default behind independent kill switches (`FORWARDING_EXECUTION_ENABLED` and `CAMPAIGN_EXECUTION_ENABLED`). Other external actions remain non-executing until dedicated adapters are connected. The production flow is:

```
Inbox / Campaign -> Agent Router -> Signed Human Approval Gate -> MABRIG Mail
```

This keeps credentials and consequential actions on the server side and makes later automation auditable.

## Stack

- Next.js 16.3.3 App Router
- React 19.2
- TypeScript
- Server-side AI gateway adapter
- Server-side BillionMail bridge
- GitHub Actions build verification

Next.js 16.3.3 is used because it is the current Active LTS security release as of September 2026.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

```bash
NEXT_PUBLIC_APP_NAME="MABRIG AI Mail Agent"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

ADMIN_EMAIL=""
ADMIN_PASSWORD_SHA256=""
AUTH_SECRET=""
APPROVAL_SECRET=""

MONGODB_URI=""
MONGODB_DB_NAME="mabrig_ai_mail"
GROWTH_AUTOPILOT_COOLDOWN_DAYS="7"
CRON_SECRET=""
AUTOPILOT_CRON_SECRET=""

BILLIONMAIL_BASE_URL=""
BILLIONMAIL_API_TOKEN=""
BILLIONMAIL_USERNAME=""
BILLIONMAIL_PASSWORD=""

CAMPAIGN_EXECUTION_ENABLED="false"
CAMPAIGN_SENDER=""
CAMPAIGN_SENDER_NAME="MABRIG Technologies"
CAMPAIGN_MAX_RECIPIENTS="1000"
CAMPAIGN_START_DELAY_SECONDS="300"
CAMPAIGN_THREADS="2"
CAMPAIGN_WARMUP="true"
CAMPAIGN_TRACK_OPEN="true"
CAMPAIGN_TRACK_CLICK="true"
CAMPAIGN_REQUIRE_DNS_PASS="true"
CAMPAIGN_ATTRIBUTION_WINDOW_DAYS="14"

FORWARDING_EXECUTION_ENABLED="false"
FORWARDING_ALLOW_EXTERNAL="false"
FORWARDING_ALLOWED_SOURCE_DOMAINS="mabrigmail.online"
FORWARDING_ALLOWED_DESTINATION_DOMAINS="mabrigmail.online"
FORWARDING_BLOCKED_DESTINATION_DOMAINS=""
FORWARDING_MAX_TARGETS="5"

MAIL_DOMAIN="mabrigmail.online"
MAIL_HOSTNAME="mail.mabrigmail.online"

AI_GATEWAY_URL=""
AI_GATEWAY_API_KEY=""
AI_MODEL=""

MAX_AGENT_INPUT_CHARS="12000"
```

The AI adapter accepts an OpenAI-compatible chat-completions endpoint so a provider can be changed without rewriting the app. No provider key is committed to Git.

## Health check

`GET /api/health`

Unauthenticated requests receive only basic service health. Authenticated administrators also receive AI configuration and MABRIG Mail/BillionMail reachability status.

## Admin authentication

The control room is at `/dashboard` and requires an administrator session. Store only the SHA-256 hash of the admin password in `ADMIN_PASSWORD_SHA256`.

Example hash generation:

```bash
printf '%s' 'your-strong-password' | sha256sum
```

Use long random values for `AUTH_SECRET` and `APPROVAL_SECRET`.

## Approval API

`POST /api/actions/propose` creates a signed, expiring proposal for `send_email`, `forward_email`, `create_forward_rule`, `create_campaign`, `create_mailbox`, or `change_mail_setting`.

`POST /api/actions/approve` validates human approval and dispatches only action types with a registered executor. `create_forward_rule`, `edit_forward_rule`, and `delete_forward_rule` can execute against BillionMail when the forwarding execution gate is enabled. Journey-backed `create_campaign` actions can create a native BillionMail marketing task when `CAMPAIGN_EXECUTION_ENABLED=true`. Generic campaign proposals without a Growth Autopilot journey remain approval-only.

## Forwarding API

`POST /api/forwarding/prepare` requires an authenticated administrator, an explicit destination email address and the original message. The forwarding agent reviews the message, prepares a forwarding recommendation and creates a signed `forward_email` proposal. Approval is separate from execution; no message is forwarded until a real executor is connected.

The **Forwarding Rule Planner** is also available through `POST /api/agent` using agent `routing`. It is intended for recurring rules and must still pass through the signed approval gate before activation.

### Forwarding-rule administration

`GET /api/forwarding/rules` reads the current forwarding rules from the configured BillionMail server.

The protected dashboard can stage and approve:

- creation of a forwarding rule;
- enable/disable changes;
- deletion of an existing rule.

Before execution, the server enforces source-domain policy, destination-domain policy, blocked-domain policy, maximum destination count and loop detection against current active rules.

The bridge supports either a preconfigured `BILLIONMAIL_API_TOKEN` or server-side `BILLIONMAIL_USERNAME` / `BILLIONMAIL_PASSWORD`. Credential-based mode obtains and caches a short-lived BillionMail JWT.

BillionMail currently exposes these operations through its authenticated console API (`/api/mail_forward/list`, `/add`, `/edit`, `/delete`). This is treated as an adapter boundary in this project so upstream route changes can be isolated to `lib/billionmail.ts`.

### Audit behavior

MABRIG emits structured `MABRIG_AUDIT` runtime events for approvals, executions, failures and rejections without logging message bodies, passwords or tokens. BillionMail also records its own mail-forward configuration operations.

## Agent API

`POST /api/agent`

Example:

```json
{
  "agent": "deliverability",
  "input": "SPF passes but messages to Gmail are landing in spam..."
}
```

Supported agents: `triage`, `reply`, `campaign`, `deliverability`, `operator`, `forward`, `routing`, `promotion`, `growth`, `lifecycle`, `sales`, `autopilot`.

## Customer Growth Graph

When `MONGODB_URI` is configured, MABRIG gains durable business memory across server instances. The graph stores operational customer-growth data, not raw mailbox content.

Persisted collections include:

- contacts with lifecycle stage, tags, market and current consent state;
- interaction events such as opens, clicks, replies, pricing visits, quote requests, purchases, referrals and unsubscribes;
- purchase history used for repeat-customer, reactivation and referral logic;
- transparent lead/opportunity assessments;
- exact-once approval execution claims;
- structured audit events.

The graph automatically produces useful business segments such as **Permissioned Audience**, **Engaged in 30 Days**, **High-Intent Signals**, **Opportunity Radar**, **Reactivation Candidates**, and **Referral Candidates**.

Unsubscribe events immediately turn off the stored marketing-consent flag. Consent-granted events can turn it back on with a source and timestamp.

Passwords, API tokens, bearer tokens and raw email bodies are intentionally excluded from the growth graph.

## Marketing APIs

`POST /api/marketing/growth-plan` runs the Business Promotion, Growth Intelligence, Lifecycle and Sales agents in parallel against one business brief and returns a four-part growth system.

`POST /api/marketing/lead-score` applies transparent deterministic lead scoring to supplied engagement signals and then asks the Sales Opportunity Agent for a cautious next-best action and follow-up draft. If a contact email is supplied and MongoDB is configured, the assessment is persisted into Opportunity Radar.

The Growth Studio can stage the resulting plan as a signed `create_campaign` proposal. Generic Growth Studio proposals remain planning-only. Growth Autopilot journey proposals use the verified BillionMail campaign executor described below.

## Growth Graph APIs

- `GET/POST /api/growth/contacts` — list or upsert business contacts.
- `POST /api/growth/interactions` — record permission, engagement, purchase and referral signals.
- `GET /api/growth/segments` — compute live consent-aware growth segments.
- `GET /api/growth/opportunities` — return the highest current transparent opportunity scores.

MongoDB persistence also upgrades approval replay protection from process-local memory to an atomic database-backed exact-once claim, which is appropriate for multi-instance/serverless deployments.

## Growth Autopilot

Growth Autopilot turns the persistent Customer Growth Graph into an approval-controlled journey engine.

It currently detects four deterministic opportunities:

- **High-Intent Conversion** — permissioned contacts with recent reply, pricing or quote-request signals.
- **Opportunity Radar Follow-Up** — permissioned contacts with stored transparent opportunity scores of 55+.
- **Customer Reactivation** — permissioned customers whose latest recorded purchase is older than 90 days.
- **Referral & Advocacy** — permissioned repeat customers with at least two recorded purchases.

The database decides whether a segment qualifies. AI receives only the segment definition, eligible count, objective and operating constraints; individual customer identities are not required to design the journey.

Each generated journey is stored with a lifecycle:

`draft → approval-staged → approved-awaiting-executor` (execution disabled) **or** `draft → approval-staged → scheduled` (execution enabled)

or it can be dismissed. A signed administrator approval is required before a journey can move into an approved or scheduled state. If execution is disabled, the approved copy and hashed audience snapshot are preserved and can later be re-staged for a fresh signed execution approval without widening the audience.

### Verified BillionMail campaign executor

Growth Autopilot uses BillionMail's native marketing-task workflow rather than the lower-level raw batch-send endpoint.

The server-side executor performs this sequence only after a valid signed human approval:

1. Recompute the current deterministic Growth Graph segment.
2. Keep only recipients whose email hash was present in the approval snapshot.
3. Remove anyone who is no longer permissioned or eligible.
4. Run a sender-domain DNS preflight (MX/SPF/DMARC) when `CAMPAIGN_REQUIRE_DNS_PASS=true`.
5. Create a dedicated BillionMail contact group through `/api/contact/group/create`.
6. Import the approved-current recipients through `/api/contact/group/import`.
7. Create a sanitized HTML template through `/api/email_template/create`.
8. Create a native scheduled marketing task through `/api/batch_mail/task/create`.

BillionMail then handles recipient records, unsubscribe links, warmup association, open/click tracking (when enabled), scheduling and task analytics.

The executor binds approval to:

- a SHA-256 digest of the generated campaign copy;
- a SHA-256 fingerprint of the audience snapshot;
- hashed recipient membership stored with the journey;
- the signed journey/action ID.

Recipients may be removed after approval (for example after unsubscribe), but new recipients cannot be silently added to that approval.

`CAMPAIGN_START_DELAY_SECONDS` defaults to 300 seconds so the approved task is created slightly ahead of its scheduled send time. BillionMail's task worker only processes tasks after their `start_time` has arrived.

The campaign executor is disabled by default. Set `CAMPAIGN_EXECUTION_ENABLED=true` only after the sender mailbox, DNS, BillionMail bridge and MongoDB persistence are configured and verified.

### Scheduled Autopilot scan

`GET /api/growth/journeys/autoscan` is a secret-protected, draft-generation-only scheduler endpoint.

This repository includes a `vercel.json` cron schedule that calls the endpoint daily at **06:00 UTC / 07:00 Africa/Lagos**.

Use Vercel's standard `CRON_SECRET` environment variable where available. `AUTOPILOT_CRON_SECRET` is accepted as a fallback for other schedulers.

The scheduler can generate drafts only. It cannot stage, approve or send campaigns.

The cooldown between active proposals for the same segment is controlled by `GROWTH_AUTOPILOT_COOLDOWN_DAYS` and defaults to 7 days.

### Growth Autopilot APIs

- `GET /api/growth/journeys` — list current journey proposals.
- `POST /api/growth/journeys` — run an authenticated manual opportunity scan.
- `POST /api/growth/journeys/stage` — create a signed campaign approval for a draft journey.
- `POST /api/growth/journeys/dismiss` — dismiss a non-approved proposal.
- `GET /api/growth/journeys/autoscan` — secret-protected scheduled draft scan.

## Campaign Intelligence & Revenue Attribution

Executed Growth Autopilot journeys can be synchronized with BillionMail's task-specific statistics through `/api/batch_mail/task/stat_chart`. MABRIG stores the resulting sends, delivered, bounced, opened, clicked and corresponding rates on the originating Growth Journey.

The dashboard separates two attribution classes:

- **Direct attribution** — a recorded business event carries a `campaignId` matching the Growth Journey ID, BillionMail task ID, `bm:<taskId>`, or `task:<taskId>`.
- **Post-send assisted** — an event occurred within the configured attribution window for someone in the approved campaign audience, but no campaign ID was supplied. This is shown as an observed assisted signal and is not presented as proof that the campaign caused the event.

`CAMPAIGN_ATTRIBUTION_WINDOW_DAYS` defaults to 14 days and is capped at 90 days.

Purchase, reply, quote-request and referral events can carry a campaign attribution ID through the Customer Growth Graph. Purchase records retain that ID for future analysis.

Administrators can also record actual campaign spend. When spend and directly attributed revenue use the same currency, MABRIG calculates **direct ROAS**. This is revenue divided by campaign spend; it is deliberately not labelled profit ROI because cost of goods, labour, tax and overhead are not known.

Campaign intelligence APIs:

- `GET /api/growth/campaign-intelligence` — list stored executed campaign intelligence.
- `POST /api/growth/campaign-intelligence` — refresh one journey or all recent executed campaigns from BillionMail.
- `POST /api/growth/campaign-intelligence/spend` — record campaign spend and recalculate direct ROAS.

The daily Growth Autopilot cron also performs a read-only campaign-intelligence refresh. A metrics-sync failure does not grant send capability and does not bypass the human approval gate.

## Production topology

Deploy this Next.js application independently from the underlying mail server. The AI/dashboard layer can run on Vercel, while SMTP/IMAP/Postfix/Dovecot/Rspamd/Postgres remain on a persistent Linux VPS running the MABRIG Mail/BillionMail stack.

Recommended public endpoints:

- `mabrigmail.online` — product/dashboard
- `mail.mabrigmail.online` — mail hostname
- `webmail.mabrigmail.online` — webmail, if separated
- `api.mabrigmail.online` — optional hardened mail-control bridge

## Roadmap

1. ✅ Authenticated MABRIG Mail admin workspace.
2. Read-only inbox connector and thread summarisation.
3. ✅ Signed approval-queued action workflow.
4. ✅ Business Growth OS, campaign planning, lead intelligence and verified approval-controlled BillionMail campaign execution.
5. ✅ Deliverability checks and DNS diagnostics.
6. Forwarding-rule administration and multi-domain mailbox administration.
7. ✅ Persistent Customer Growth Graph, audit logs and durable approval execution state.
8. ✅ Approval-controlled Growth Autopilot with scheduled draft scans.
9. ✅ Task-specific Campaign Intelligence, conservative revenue attribution and direct ROAS.
10. Provider/model routing with cost and quality controls.
11. Role-based permissions for administrators and operators.
12. Observability, rate limiting and security event logging.

## Upstream mail engine

The intended mail-server foundation is BillionMail. BillionMail is AGPLv3; preserve its license and source-availability obligations for any modified network-deployed derivative. This repository is the separate MABRIG AI/application layer and should not remove upstream notices from the mail engine.

## Brand

**MABRIG AI Mail Agent**  
A MABRIG Technologies product.
