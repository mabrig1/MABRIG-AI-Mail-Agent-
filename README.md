# MABRIG AI Mail Agent

**MABRIG AI Mail Agent** is the intelligent operations layer for MABRIG Mail. It is designed to sit in front of a self-hosted mail platform such as BillionMail and provide inbox assistance, campaign intelligence, deliverability diagnostics and safe operational guidance without giving an AI model unrestricted access to SMTP credentials.

## Current agents

- **Inbox Triage** — summarises incoming messages, extracts actions and highlights urgency.
- **Reply & Compose** — creates fact-preserving drafts while keeping sending under human control.
- **Campaign Coach** — produces segmentation, subject-line, copy, CTA and measurement plans.
- **Deliverability Guardian** — diagnoses SPF, DKIM, DMARC, PTR/rDNS, reputation, list and content issues.
- **Mail-Server Operator** — explains likely server problems and proposes minimum-risk diagnostics.

## Safety model

The current release runs in **approval-controlled mode**. AI output can recommend or draft actions, signed action proposals expire after 15 minutes, and external mail execution remains disabled until a real executor is connected. The production flow is:

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

`POST /api/actions/propose` creates a signed, expiring proposal for `send_email`, `create_campaign`, `create_mailbox`, or `change_mail_setting`.

`POST /api/actions/approve` validates human approval but intentionally does **not** execute an external side effect yet.

## Agent API

`POST /api/agent`

Example:

```json
{
  "agent": "deliverability",
  "input": "SPF passes but messages to Gmail are landing in spam..."
}
```

Supported agents: `triage`, `reply`, `campaign`, `deliverability`, `operator`.

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
5. Deliverability checks and DNS diagnostics.
6. Multi-domain mailbox administration.
7. Scheduled automations with audit logs.
8. Provider/model routing with cost and quality controls.
9. Role-based permissions for administrators and operators.
10. Observability, rate limiting and security event logging.

## Upstream mail engine

The intended mail-server foundation is BillionMail. BillionMail is AGPLv3; preserve its license and source-availability obligations for any modified network-deployed derivative. This repository is the separate MABRIG AI/application layer and should not remove upstream notices from the mail engine.

## Brand

**MABRIG AI Mail Agent**  
A MABRIG Technologies product.
