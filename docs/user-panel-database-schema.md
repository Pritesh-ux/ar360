# User Panel — Database Schema (Stage 2)

Canonical reference for user panel tables added in migrations **16–18**.

## New Tables

| Table | Purpose |
|-------|---------|
| `customer_notifications` | User panel bell feed (scoped by `customer_uid`) |
| `user_preferences` | Theme, grid/list, pagination, email notification prefs |
| `share_links` | Share Center links (public, embed, QR, email types) |
| `share_events` | Per-share analytics events |
| `qr_scan_events` | QR scan tracking with session dedup support |
| `payment_methods` | Provider payment method display metadata (no card numbers) |

## Extended Tables

### `products`
| Column | Type | Purpose |
|--------|------|---------|
| `tags` | JSON | Product tag filters |
| `deleted_at` | DATETIME | Soft delete |
| `archived_at` | DATETIME | Archive timestamp |
| `processing_error` | VARCHAR(512) | Failed processing message |

### `product_qr_codes`
| Column | Type | Purpose |
|--------|------|---------|
| `qr_uid` | VARCHAR(64) UNIQUE | Stable QR identifier |
| `name` | VARCHAR(160) | Display name (e.g. "Main QR", "AR View QR") |
| `status` | ENUM | active / expired / archived / processing |
| `expires_at` | DATETIME | Optional expiry |
| `deleted_at` | DATETIME | Soft delete |
| `style_json` | JSON | Extended design settings |

**Constraint change:** `uq_product_qr_product` (one QR per product) removed → multiple QR codes per product allowed.

## Indexes (Migration 17)

- `idx_products_customer_status`
- `idx_products_customer_folder`
- `idx_products_customer_category`
- `idx_products_customer_created`
- `idx_support_tickets_customer_status`
- `idx_customer_subscriptions_status_end`
- `idx_billing_invoices_customer_created`

## Runtime DDL

Dev mode applies the same schema via:

```
src/lib/user-panel/schema.ts → ensureUserPanelSchema()
```

Called from `ensureAppSchema()` in `src/lib/db.ts`.

Production: set `SKIP_RUNTIME_DDL=true` and use migrations only.

## Commands

```bash
npm run db:status    # Check pending migrations
npm run db:migrate   # Apply 16–18
npm run db:seed      # Seed plans + demo customer + user_preferences
```

## Data Fix

Migration 16 normalizes legacy plan IDs:

```sql
UPDATE customers SET plan_id = 'trial' WHERE plan_id = 'free';
```
