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

## Safety model

The current release runs in **approval-controlled mode**. AI output can recommend or draft actions and signed action proposals expire after 15 minutes. Verified forwarding-rule operations have a real BillionMail executor, but that executor is disabled by default until `FORWARDING_EXECUTION_ENABLED=true`. Other external actions remain non-executing until dedicated adapters are connected. The production flow is:

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

BILLIONMAIL_BASE_URL=""
BILLIONMAIL_API_TOKEN=""
BILLIONMAIL_USERNAME=""
BILLIONMAIL_PASSWORD=""

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

`POST /api/actions/approve` validates human approval and dispatches only action types with a registered executor. `create_forward_rule`, `edit_forward_rule`, and `delete_forward_rule` can execute against BillionMail when the forwarding execution gate is enabled. Other action types remain approval-only.

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

Supported agents: `triage`, `reply`, `campaign`, `deliverability`, `operator`, `forward`, `routing`.

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
4. Campaign creation and list segmentation.
5. ✅ Deliverability checks and DNS diagnostics.
6. Forwarding-rule administration and multi-domain mailbox administration.
7. Scheduled automations with audit logs.
8. Provider/model routing with cost and quality controls.
9. Role-based permissions for administrators and operators.
10. Observability, rate limiting and security event logging.

## Upstream mail engine

The intended mail-server foundation is BillionMail. BillionMail is AGPLv3; preserve its license and source-availability obligations for any modified network-deployed derivative. This repository is the separate MABRIG AI/application layer and should not remove upstream notices from the mail engine.

## Brand

**MABRIG AI Mail Agent**  
A MABRIG Technologies product.
