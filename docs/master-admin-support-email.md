# Master Admin — Support Tickets & Email Center (Stage 14)

Stage 14 production-hardens **Support Tickets** and implements the **Email Center** with delivery logs, admin send, and ticket reply notifications.

## Canonical sources

### Support tickets

| Layer | Path |
|-------|------|
| Service | `src/lib/master-admin/support-tickets.service.ts` |
| API list | `GET/POST /api/master-admin/support-tickets` |
| API detail | `GET/PATCH /api/master-admin/support-tickets/[id]` |
| Page | `src/app/master-admin/(panel)/support-tickets/page.tsx` |
| Modals | `TicketDetailModal.tsx`, `CreateTicketModal.tsx` |

### Email center

| Layer | Path |
|-------|------|
| Email logging | `src/lib/email/email-log.ts` |
| Send wrapper | `src/lib/email/send-email.ts` |
| Service | `src/lib/master-admin/email-center.service.ts` |
| API | `GET/POST /api/master-admin/email-center` |
| Page | `src/app/master-admin/(panel)/email-center/page.tsx` |
| Send modal | `SendEmailModal.tsx` |

## Support tickets API

### `GET /api/master-admin/support-tickets`

| Param | Purpose |
|-------|---------|
| `search` | Ticket number, subject, customer, description |
| `status`, `priority`, `assigned`, `category` | Filters |
| `dateFrom`, `dateTo` | Created date range |
| `page`, `pageSize` | Pagination |
| `export=csv` | Server CSV export (max 5000 rows) |

**Permission:** `tickets.read`

### `PATCH /api/master-admin/support-tickets/[id]`

Updates status, priority, assignment; optional `reply` adds admin message and emails the customer (`support_ticket_reply` template).

**Permission:** `tickets.manage`

### Assignees

Loaded from active `master_admins` plus distinct assignees on existing tickets (no demo seed list).

### Analytics (filtered)

- Status breakdown donut
- Category breakdown bars
- Average resolution time (resolved/closed)
- Open ticket aging buckets

### Audit

- `ticket.create`, `ticket.update`, `ticket.reply`

## Email center API

### `GET /api/master-admin/email-center`

| Param | Purpose |
|-------|---------|
| `search` | Recipient, subject, template |
| `status` | `sent`, `failed`, `console`, or `all` |
| `template` | Template id filter |
| `dateFrom`, `dateTo` | Log date range |
| `export=csv` | Download logs |

**Permission:** `settings.read`

### `POST /api/master-admin/email-center`

| Body | Purpose |
|------|---------|
| `{ to, subject, body, template? }` | Send custom/admin email |
| `{ action: "retry", logId }` | Retry failed templated delivery |

**Permission:** `settings.manage`

### Email logs table

Runtime DDL: `email_logs` — recipient, subject, template, status, provider message id, error, timestamps.

All sends through `sendEmail()` are logged (`sent`, `failed`, or `console` when SMTP is not configured).

## UI improvements

### Support tickets
- Removed fake trend percentages and sparklines
- Filter-respecting summary KPIs
- Server CSV export
- Open ticket aging panel
- Reply sends customer email with feedback in UI

### Email center
- Replaced “Coming soon” placeholder with full page
- Removed **Soon** badge from sidebar nav
- Stats: sent, failed, console, total
- Log table with retry for failed templated emails
- Send email modal + link to SMTP settings

## Validation

```bash
npx tsc --noEmit
```

Manual checks:
1. `/master-admin/support-tickets` — create ticket, reply, verify email log entry.
2. Export tickets CSV with filters.
3. `/master-admin/email-center` — view logs from billing/ticket emails.
4. Send custom email from modal.
5. Assignees list shows real master admins.
