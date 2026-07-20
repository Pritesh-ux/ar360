# Master Admin Architecture (Canonical)

**Stage 6 baseline** — database migrations + seed foundation + admin RBAC + shared UI components + shell features + real dashboard metrics

See also:
- [master-admin-permissions.md](./master-admin-permissions.md)
- [master-admin-design-system.md](./master-admin-design-system.md)
- [master-admin-shell-features.md](./master-admin-shell-features.md)
- [master-admin-dashboard.md](./master-admin-dashboard.md)

---

## Database strategy

| Environment | Schema source |
|-------------|---------------|
| Local dev (XAMPP) | `npm run db:migrate` then optional `npm run db:seed` |
| Production | Migrations only; `SKIP_RUNTIME_DDL=true` recommended |
| Runtime fallback | `ensureAppSchema()` in `src/lib/db.ts` for dev convenience |

**Status command:** `npm run db:status`

---

## Canonical domain sources

| Domain | Tables | Service layer |
|--------|--------|---------------|
| Plans | `billing_plans` | `lib/billing/admin-plans.ts`, `resolve-plan-limits.ts` |
| Subscriptions | `customer_subscriptions` | `server/billing/subscription.*` |
| Payments | `billing_payments` | `lib/billing/payment-ledger.ts` |
| Invoices | `billing_invoices` | `server/billing/invoice.service.ts` |
| Customers | `customers`, `users` | `lib/auth.ts`, customer APIs |
| Products | `products` | `lib/products/*`, product APIs |
| Analytics | `analytics_events`, `analytics_daily` | `server/analytics/*` |
| Storage | `customers.storage_used_mb`, `storage_usage_snapshots` | `lib/storage/*` |
| Coupons | `coupons`, `coupon_redemptions` | Migration 11 + future module |
| Support | `support_tickets` | Migration 11 + future module |
| Settings | `platform_settings` | `lib/master-admin-settings.ts` |

**Deprecated / do not use for new code:**
- `plans` (legacy marketing table)
- `payments` (legacy admin table)
- `login_logs` (use `auth_login_logs`)

---

## Master Admin API routes (canonical)

| Route | Purpose |
|-------|---------|
| `/api/master-admin/customers` | Customer list + suspend |
| `/api/master-admin/customers/[id]` | Customer detail |
| `/api/master-admin/billing/customers/[uid]/plan` | Plan assignment |
| `/api/master-admin/subscriptions` | Subscription list |
| `/api/master-admin/billing` | Invoices + revenue summary |
| `/api/master-admin/payments` | Ledger CRUD (legacy path; consolidate into billing) |
| `/api/master-admin/products` | Product list |
| `/api/master-admin/viewer-analytics` | Platform analytics |
| `/api/master-admin/storage` | Storage audit + snapshots |
| `/api/master-admin/coupons` | Coupon CRUD + export + redemptions |
| `/api/master-admin/support-tickets` | Ticket list, detail, reply, export |
| `/api/master-admin/email-center` | Email logs + send/retry |
| `/api/master-admin/audit-logs` | Immutable admin audit trail |
| `/api/master-admin/activity-logs` | Platform activity (products + payments) |
| `/api/master-admin/system-health` | Live health probes |
| `/api/master-admin/admins` | Admin user + role management |
| `/api/master-admin/settings` | Platform settings |

---

## Demo data policy (Stage 2)

Demo coupons and support tickets are **never** auto-inserted by API routes.

Seed via:

```bash
# Development (default SEED_DEMO_DATA when NODE_ENV != production)
npm run db:seed

# Production — opt-in only
SEED_DEMO_DATA=true npm run db:seed

# Disable demo admin data
SEED_DEMO_DATA=false npm run db:seed
```

Modules:
- `src/lib/seed/config.ts`
- `src/lib/seed/demo-coupons.ts`
- `src/lib/seed/demo-support-tickets.ts`

---

## Storage growth charts

Real data path:
1. Each storage API request upserts today's row in `storage_usage_snapshots`
2. Chart reads last 30 days from snapshots
3. If no history, shows single point at current usage

No synthetic interpolation in production APIs.

---

## Legacy URL redirects (Stage 2)

| Legacy | Canonical |
|--------|-----------|
| `/master-admin/payments` | `/master-admin/billing` |
| `/master-admin/billing/payments` | `/master-admin/billing` |
| `/master-admin/billing/invoices` | `/master-admin/billing` |
| `/master-admin/analytics` | `/master-admin/viewer-analytics` |
| `/master-admin/bandwidth` | `/master-admin/viewer-analytics` |

---

## Rebuild procedure (crashed local MySQL)

```bash
npm run db:check
npm run db:reset          # dev only — drops DB, migrates, seeds
# OR manually:
npm run db:migrate
npm run db:seed
npm run db:status
```

---

*Next: Stage 3 — master-admin RBAC and route protection.*
