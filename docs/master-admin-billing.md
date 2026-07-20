# Master Admin — Billing & Invoices (Stage 11)

Stage 11 production-hardens the **Billing** module with server-side exports, PDF invoices, admin invoice generation, payment reminders, manual payments, and a full refund flow with audit logging.

## Canonical sources

| Layer | Path |
|-------|------|
| Billing actions service | `src/lib/master-admin/billing-actions.service.ts` |
| Invoice PDF | `src/lib/billing/invoice-pdf.ts` |
| Billing API | `GET /api/master-admin/billing` |
| Invoice download | `GET /api/master-admin/billing/invoices/[id]/download` |
| Generate invoice | `POST /api/master-admin/billing/invoices/generate` |
| Payment reminder | `POST /api/master-admin/billing/payment-reminder` |
| Refund | `POST /api/master-admin/payments/[id]/refund` |
| Page | `src/app/master-admin/(panel)/billing/page.tsx` |

## API

### `GET /api/master-admin/billing`

| Param | Purpose |
|-------|---------|
| `search` | Customer name, email, invoice number, plan |
| `plan` | Filter by plan id |
| `status` | `Paid`, `Pending`, `Failed`, `Refunded`, or `all` |
| `dateFrom`, `dateTo` | Payment date range |
| `page`, `pageSize` | Paginated invoice rows |
| `export=csv` | Download filtered billing CSV (max 5000 rows) |

**Permission:** `billing.read`

### Invoice download

`GET /api/master-admin/billing/invoices/[id]/download`

| Param | Purpose |
|-------|---------|
| `format=pdf` | Server-generated PDF via PDFKit |
| (default) | Inline HTML invoice |

**Permission:** `billing.read` or `exports.download`

### Generate invoice

`POST /api/master-admin/billing/invoices/generate`

Body: `{ customerUid, planId, period, amountPaise? }`

Creates a **draft** tax invoice from plan pricing (or custom amount). Writes audit log `invoice.generate`.

**Permission:** `invoices.generate`

### Payment reminder

`POST /api/master-admin/billing/payment-reminder`

Body: `{ paymentUid }`

Emails the customer for **pending** payments only. Writes audit log `billing.payment_reminder`.

**Permission:** `billing.manage`

### Refund

`POST /api/master-admin/payments/[id]/refund`

Body: `{ note? }`

- Razorpay payments: initiates gateway refund when a real payment id exists
- Manual / unlinked payments: marks refunded in AR360 only
- Updates `billing_payments.status` to `refunded`
- Inserts into `billing_refunds` (created at runtime if missing)
- Writes audit log `billing.refund`

**Permission:** `billing.refund`

## UI improvements

- Stat cards show **filtered range subtitle** instead of fake trend percentages
- Revenue sidebar shows **Filtered range** instead of hardcoded growth
- **Download Report** exports CSV via API with current filters
- **Generate Invoice** and **Add Manual Payment** modals wired to APIs
- Row actions: PDF download, HTML view, send invoice, refund (paid), payment reminder (pending)
- Quick actions: download, generate, reminder, manual payment, process refund

## Dependencies

- `pdfkit` — server-side invoice PDF generation

## Validation

```bash
npx tsc --noEmit
```

Manual checks:
1. Open `/master-admin/billing` — summary and table load from DB.
2. Apply filters and export CSV — download matches filters.
3. Download invoice PDF and HTML for a row with `invoiceUid`.
4. Generate draft invoice from modal — appears after refresh.
5. Send payment reminder for a pending row.
6. Refund a paid payment — status becomes Refunded; audit entry created.
