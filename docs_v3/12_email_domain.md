# ControlFile – Email Domain

---

## Overview

The email domain manages vehicle event alerts for ControlAudit. It is a **read/write backend** for alert state — it does not send emails itself. A separate email sender (cron job or external service) polls for pending alerts, sends them, then marks them as sent.

**Prefix:** `/api/email/` ONLY — no `/v1/` path. Not proxied through Next.js.

---

## Authentication Model

> **This domain uses a different auth model than the rest of the backend.**

Email endpoints use a **shared secret token**, not Firebase ID tokens.

| Header | Value | Required |
|---|---|---|
| `x-local-token` | Value of `LOCAL_EMAIL_TOKEN` env var | Yes |

If `LOCAL_EMAIL_TOKEN` is not set in the environment, all requests are rejected with `500`.

Do NOT send `Authorization: Bearer ...` — it is not used here.

---

## Alert System Architecture

```
Email arrives at Resend inbound domain
    ↓
POST /api/email/email-inbound (Resend webhook)
    ↓
Parser extracts vehicle events
    ↓
Stored in apps/emails/dailyAlerts/{dateKey}/{plate}
    ↓
External cron polls GET /api/email/get-pending-daily-alerts
    ↓
Cron sends emails to responsables
    ↓
Cron marks sent: POST /api/email/mark-alert-sent
```

Alternatively:
```
Local Outlook script
    ↓
POST /api/email/email-local-ingest
    ↓ (same pipeline from here)
```

---

## Endpoints

### GET /api/email/get-pending-daily-alerts

Get daily alert summaries that have not yet been sent. Returns one consolidated entry per responsable email.

**Auth:** `x-local-token` header

**Response `200`:**
```json
[
  {
    "responsableEmails": ["user@example.com"],
    "subject": "Resumen de alertas - 2026-03-19",
    "body": "<html>...</html>",
    "alertIds": ["alert-id-1", "alert-id-2"]
  }
]
```

Each item represents one email to send. `alertIds` must be passed back to `mark-alert-sent` after sending.

**Behavior:**
- Looks back up to 5 days for unsent alerts
- Consolidates all pending alerts for each responsable into a single summary email
- Does not send — returns data for external sender

---

### POST /api/email/mark-alert-sent

Mark alert IDs as sent. Called by external sender after successfully sending.

**Auth:** `x-local-token` header

**Request:**
```json
{
  "alertIds": ["alert-id-1", "alert-id-2"]
}
```

**Response `200`:**
```json
{ "success": true }
```

**Side effects:** Updates `apps/emails/dailyAlerts` documents with `sentAt` timestamp

---

### POST /api/email/email-inbound

Resend inbound email webhook. Called by Resend when a vehicle alert email is received on the inbound domain.

**Auth:** None (Resend validates via signature — no `x-local-token` required)

**Flow:**
1. Resend POSTs webhook with `email_id` (metadata only — no content)
2. Handler fetches email content from Resend Receiving API (`GET /emails/receiving/{email_id}`)
3. Retries up to 3 times with progressive backoff
4. Parses vehicle events from email body
5. Persists events to Firestore

**Response `200`:** `{ success: true }`

---

### POST /api/email/email-local-ingest

Ingest an email from a local Outlook script (alternative to Resend inbound).

**Auth:** `x-local-token` header

**Request:**
```json
{
  "source": "outlook-local",
  "email": {
    "message_id": "unique-id",
    "from": "sender@example.com",
    "to": ["recipient@example.com"],
    "subject": "Vehicle Alert",
    "body_text": "...",
    "body_html": "<html>...</html>",
    "received_at": "2026-03-20T10:00:00Z",
    "attachments": []
  }
}
```

`source` must be `"outlook-local"`.

**Response `200`:** `{ success: true }`

**Behavior:** Same parsing and storage pipeline as `email-inbound`.

---

## Firestore Collections

| Collection | Purpose |
|---|---|
| `apps/emails/dailyAlerts/{dateKey}` | Subcollection of daily alert summaries per date (YYYY-MM-DD) |
| `apps/emails/vehicles/{plate}` | Vehicle records with responsible email lists |
| `apps/emails/config/config` | Global email recipient config (generalRecipients, ccRecipients, reportRecipients) |
| `apps/emails/access` | Synced access users list (rebuilt by `syncAccessUsers()`) |

---

## Admin Endpoints for Email Config

Email configuration (recipients) is managed via the `/api/admin/` domain with Firebase auth (not `x-local-token`). See [07_endpoints_reference.md](./07_endpoints_reference.md):

- `GET /api/admin/email-config` — read recipient lists
- `PATCH /api/admin/email-config` — update recipient lists
- `PATCH /api/admin/vehicle-alerts` — update vehicle responsables
- `POST /api/admin/sync-access-users` — rebuild access list

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `LOCAL_EMAIL_TOKEN` | Shared secret for `x-local-token` auth on email endpoints |
