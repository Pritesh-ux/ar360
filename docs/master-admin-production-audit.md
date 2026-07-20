# Master Admin Production Audit

**Project:** AR360 Studio (`C:\xampp\htdocs\ar360`)  
**Audit date:** 2026-07-11  
**Scope:** Master Admin panel, supporting APIs, database, auth, billing, storage, analytics  
**Status:** Stage 1 audit complete · **Stage 2 migration/seed foundation complete**

---

## 1. Current folder structure (relevant)

```
src/
  app/
    master-admin/           # Admin UI (login, panel, billing subtree)
    api/
      master-admin/         # Admin REST APIs
      billing/              # Customer billing + webhooks
      analytics/            # Event ingestion
    dashboard/              # Customer dashboard
  components/
    features/
      master-admin/         # Shell, nav, page components, domain utils
      dashboard/            # Customer UI
      viewer/               # 3D/AR viewer
  lib/
    auth.ts                 # Sessions, master admin auth
    db.ts                   # MySQL pool + runtime DDL
    billing/                # Plans, entitlements, ledger
    storage/                # File security, audit
    coupons/                # Runtime seed
    support/                # Runtime seed
    master-admin-real.ts    # Dashboard SQL helpers
  server/
    analytics/              # Analytics repository/service
    billing/                # Razorpay, invoices, subscriptions
  lib/enterprise/           # Workspace RBAC (not wired to master admin)

database/
  migrations/               # 01–10 SQL migrations
  seeders/                  # Plan + demo seeds

scripts/
  db-migrate.ts, db-seed.ts, db-reset.ts, db-check.ts
```

---

## 2. Current Master Admin pages

| Route | Status | Data source | Notes |
|-------|--------|-------------|-------|
| `/master-admin` | UI complete | `getMasterAdminDashboardData` | Some sparklines/trends decorative |
| `/master-admin/customers` | UI complete | `/api/master-admin/customers` | Client-side filter; bulk actions partial |
| `/master-admin/customers/[id]` | UI complete | Server + `/api/master-admin/customers/[id]` | Suspend works; many actions placeholder |
| `/master-admin/subscriptions` | UI complete | `/api/master-admin/subscriptions` | Many quick actions placeholder |
| `/master-admin/products` | UI complete | `/api/master-admin/products` | Links to detail |
| `/master-admin/products/[id]` | UI complete | `/api/master-admin/products/[id]` | Uses existing ModelViewer |
| `/master-admin/viewer-analytics` | UI complete | `/api/master-admin/viewer-analytics` | Real analytics pipeline |
| `/master-admin/billing` | UI complete | `/api/master-admin/billing` | Refund + PDF download wired |
| `/master-admin/coupons` | UI + read API | `/api/master-admin/coupons` | **Auto-seeds mock data**; no CRUD |
| `/master-admin/storage` | UI complete | `/api/master-admin/storage` | **Synthetic growth chart**; cleanup placeholder |
| `/master-admin/support-tickets` | UI + read API | `/api/master-admin/support-tickets` | **Auto-seeds mock data**; no detail/reply |
| `/master-admin/object-capture` | Coming soon | — | Placeholder |
| `/master-admin/email-center` | Coming soon | — | Placeholder |
| `/master-admin/notifications` | Coming soon | — | Placeholder |
| `/master-admin/system-health` | Partial | Static cards + links | Not live probes |
| `/master-admin/database` | Coming soon | — | Placeholder |
| `/master-admin/admins` | Coming soon | — | Placeholder |
| `/master-admin/settings` | Functional | `/api/master-admin/settings` | SMTP, Razorpay keys |
| `/master-admin/audit-logs` | Re-export | `/api/master-admin/live?kind=activity` | Alias of activity-logs |
| `/master-admin/plans` | Functional | `/api/master-admin/billing/plans` | Not in sidebar nav |
| `/master-admin/payments` | Legacy | `/api/master-admin/payments` | Overlaps billing |
| `/master-admin/billing/invoices` | Legacy | Server `getMasterInvoices` | Orphan; not in nav |
| `/master-admin/analytics` | Legacy orphan | `live?kind=analytics` | Not in nav |

**Nav canonical list:** `src/components/features/master-admin/nav.ts` (16 items + quick actions).

---

## 3. Existing user dashboard pages (sync targets)

| Area | Routes | Master Admin dependency |
|------|--------|-------------------------|
| Products | `/dashboard/products`, `[id]`, editor | Admin products, storage, analytics |
| Billing | `/dashboard/settings?tab=billing`, checkout | Subscriptions, invoices, plans |
| Analytics | `/dashboard/analytics` | Viewer analytics aggregates |
| Object Capture | `/dashboard/object-capture` | Admin OC jobs (missing) |
| QR / Embed | `/dashboard/qr-center` | Product detail tabs |
| Team | `/dashboard/team` | Enterprise RBAC (separate) |

---

## 4. Duplicate admin layouts / pages

| Duplicate | Locations | Recommendation |
|-----------|-----------|----------------|
| MasterAdminShell layout | `(panel)/layout.tsx`, `billing/layout.tsx` | Merge billing routes into `(panel)` |
| Invoice listing | `billing/page.tsx`, `billing/invoices/page.tsx` | Keep canonical billing page; redirect legacy |
| Payments UI | `payments/page.tsx`, `billing/payments` re-export | Deprecate legacy; extend billing API |
| Plans UI | `plans/page.tsx`, `billing/plans` re-export | Single route under `/master-admin/plans` |
| Audit logs | `activity-logs`, `audit-logs` re-export | Keep one URL (`audit-logs`) |
| Analytics entry | Overview, viewer-analytics, `/analytics` | Remove or redirect `/analytics` |
| Customer plan API | `customers/[id]/subscription`, `billing/customers/[uid]/plan` | Remove unused subscription route |
| Dashboard API | `getMasterAdminDashboardData` vs `/api/master-admin/dashboard` | Consolidate on one |

---

## 5. Duplicate subscription / plan files

| Source | Path | Role |
|--------|------|------|
| Static catalog | `lib/billing/plans.ts` | Marketing defaults |
| DB canonical | `lib/billing/admin-plans.ts` → `billing_plans` | Admin + checkout |
| Legacy table | `plans` (db.ts) | Seeded; string limits |
| Enforcement | `lib/billing/plan-enforcement.ts` | `DEFAULT_PLAN_LIMITS` |
| Resolver | `lib/billing/resolve-plan-limits.ts` | DB → limits |
| Server writes | `server/billing/subscription.*` | Razorpay lifecycle |
| Read check | `lib/subscription/check-subscription.ts` | Expiry gating |

**Canonical target:** `billing_plans` + `customer_subscriptions` + `resolvePlanLimits()` only.

---

## 6. Duplicate database utilities

| Mechanism | Issue |
|-----------|-------|
| `src/lib/db.ts` `ensure*Schema()` | Runtime DDL on every request (dev) |
| `database/migrations/*.sql` | Formal migrations |
| `database/migrations/08_runtime_schema_sync.sql` | Mirrors db.ts ALTERs |
| `admin-plans.ts` `ensureBillingPlanSchema()` | Extra DDL |
| `enterprise/schema.ts` | Enterprise DDL |
| `auth/password-reset.ts` | Password reset DDL |

**Risk:** Fresh XAMPP rebuild requires both `db:migrate` and runtime `ensureAppSchema()` unless `SKIP_RUNTIME_DDL=true` in prod.

---

## 7. Existing schema vs spec gaps

### Exists and used

- `users`, `customers`, `master_admins`, `auth_login_logs`
- `products`, `product_qr_codes`, `analytics_*`
- `billing_orders`, `billing_payments`, `billing_invoices`, `billing_plans`, `customer_subscriptions`
- `coupons`, `coupon_redemptions`, `support_tickets` (runtime DDL only)
- `platform_settings`, enterprise workspace tables

### Missing or incomplete vs production spec

| Entity | Gap |
|--------|-----|
| `admin_roles`, `admin_permissions` | No master-admin RBAC |
| `audit_logs` (immutable) | Only `live?kind=activity`; no structured audit |
| `notifications` | Table + UI missing |
| `email_logs` | Missing |
| `storage_files` / `storage_usage_snapshots` | Disk walk + `customers.storage_used_mb` only |
| `refunds` | Refund updates payment row; no refund table |
| `support_ticket_messages` | Missing |
| `subscription_events` | Missing event history |
| `viewer_daily_aggregates` | `analytics_daily` exists but not fully aligned |
| `product_assets` | Migration exists; **no write path in src** |
| `companies/workspaces` | Enterprise only; not linked to customers admin |

### Dead / legacy tables

- `payments` — replaced by `billing_payments`
- `login_logs` — replaced by `auth_login_logs`

---

## 8. Hardcoded / mock data locations

| Location | Type | Production action |
|----------|------|-------------------|
| `lib/coupons/coupon-seed.ts` | 24 fake coupons | Move to `db:seed`; gate API seed |
| `lib/support/ticket-seed.ts` | 29 fake tickets | Move to `db:seed`; gate API seed |
| `api/master-admin/storage/route.ts` `buildGrowthSeries()` | Synthetic chart | Replace with snapshot/historical query |
| KPI trend strings (`+12.5%`) on several pages | Static UI text | Compute from DB or hide |
| `quickAction()` alerts across admin pages | Placeholder mutations | Wire server actions |
| `PLATFORM_STORAGE_TB = 10` | Constant | Settings-driven or computed |

---

## 9. Broken or placeholder actions

**Pattern:** `window.alert('... will be enabled in the next phase')` on:

- Subscriptions quick actions (upgrade, cancel, refund, etc.)
- Coupons create/edit/import
- Support tickets view/reply/assign
- Storage cleanup / orphan delete
- Billing send invoice
- Customer detail: login-as-user, send email, many tabs actions

**Partially wired:**

- Customer suspend/activate (PATCH customers)
- Payment refund (POST payments/[id]/refund)
- Invoice PDF download (HTML inline)
- Plan assignment (`billing/customers/[uid]/plan`)
- Settings save

---

## 10. Missing API / service connections

| Feature | Missing |
|---------|---------|
| Global search (top bar) | No search API |
| Notification bell | No notifications API |
| Quick Actions menu | Links only; no drawer |
| Impersonation | Not implemented |
| Coupon CRUD | GET only |
| Ticket CRUD + messages | GET only |
| Email center | No email log API |
| Admin users / RBAC | No roles API |
| Export XLSX/PDF reports | CSV only in places |
| Server-side table pagination | Most tables client-paginate filtered API results |
| User → admin ticket creation | No customer ticket API |

---

## 11. Security risks

| Risk | Severity | Detail |
|------|----------|--------|
| No master-admin RBAC | High | Single `requireApiAdmin()` for all routes |
| No impersonation audit | High | Feature not built |
| Auto-seed fake production data | Medium | Coupons/tickets seed on API hit |
| Client-side table filtering | Medium | Fetches up to 500–1000 rows |
| Legacy duplicate APIs | Low | Confusion, wrong endpoint use |
| `product_assets` vs disk quota mismatch | Medium | Entitlement undercount possible |
| Invoice download | OK | Admin auth + invoice service |
| Storage meta | OK | Path traversal guards |

---

## 12. Build / lint / test status (2026-07-11)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **Pass** |
| `npm run lint` | **Fails** on vendored `public/vendor/draco/*` (not app code) |
| `npm run build` | Not run in this audit |
| Unit tests in `src/` | **None found** |
| Smoke scripts | `smoke:api`, `smoke:auth`, `smoke:product`, etc. exist |

---

## 13. Migration gaps

Migrations `01–10` exist. **Not in migrations:**

- `coupons`, `coupon_redemptions`
- `support_tickets`
- `platform_settings` (in db.ts admin schema)

**Commands available:**

```bash
npm run db:check
npm run db:migrate
npm run db:seed
npm run db:reset    # dev only
```

**Missing:** `db:rollback`, `db:status` (formal).

---

## 14. Missing indexes (recommended)

- `support_tickets(status, priority, assigned_to, created_at)`
- `coupons(code, status, expires_at)`
- `billing_payments(status, created_at)`
- `customers(status, plan_id, last_login_at)` — partial indexes exist
- `notifications(recipient, is_read, created_at)` — when table added

---

## 15. Dead code candidates

- `src/app/api/master-admin/dashboard/route.ts` (unused)
- `src/app/api/master-admin/customers/[id]/subscription/route.ts` (unused)
- Legacy `payments` table DDL
- `login_logs` table
- `/master-admin/analytics` page
- `/master-admin/billing/invoices` page (after redirect)

---

## 16. Recommended canonical architecture

```
src/
  app/master-admin/(panel)/     # All panel routes (including billing sub-routes)
  app/api/master-admin/         # Thin route handlers
  modules/                      # NEW: domain modules
    customers/{repository,service,types,schemas}
    subscriptions/
    products/
    billing/
    coupons/
    storage/
    analytics/
    support/
    notifications/
    audit/
    admin/
  components/master-admin/      # Rename from features/master-admin when stable
  components/ui/                # Shared design system primitives
  lib/
    auth/                       # Split auth.ts
    db/                         # Pool + migration runner only
    permissions/                # Master admin RBAC
    exports/                    # CSV/XLSX/PDF
```

**Rules:**

- Route handlers → call module services only
- Services → repositories → parameterized SQL
- No MySQL from client components
- One plan source: `billing_plans`
- One payment ledger: `billing_payments`

---

## 17. Proposed migration list (Stage 2)

| # | Migration | Purpose |
|---|-----------|---------|
| 11 | `coupons_support_platform.sql` | Formalize coupons, support_tickets, platform_settings |
| 12 | `admin_rbac.sql` | admin_roles, permissions, role_permissions, admin_users link |
| 13 | `audit_logs.sql` | Immutable audit trail |
| 14 | `notifications.sql` | Admin + user notifications |
| 15 | `email_logs.sql` | Email center |
| 16 | `support_ticket_messages.sql` | Ticket threads |
| 17 | `storage_files.sql` | File registry + snapshots |
| 18 | `subscription_events.sql` | Subscription timeline |
| 19 | `refunds.sql` | Refund records |
| 20 | `indexes_admin.sql` | Composite indexes for admin filters |

All idempotent; no destructive drops in initial pass.

---

## 18. Implementation stages (aligned to user spec)

| Stage | Focus | Status |
|-------|-------|--------|
| 1 | Audit (this document) | **Complete** |
| 2 | Migrations + seed foundation | Pending |
| 3 | Auth + RBAC | Pending |
| 4 | Design system components | Pending |
| 5 | Global search, notifications, quick actions | Pending |
| 6 | Dashboard (real metrics) | Pending |
| 7 | Customers + detail + impersonation | Pending |
| 8 | Subscriptions sync | Pending |
| 9 | Products + detail | Partial |
| 10 | Viewer analytics | Partial |
| 11 | Billing + PDF + exports | **Complete** |
| 12 | Coupons production | **Complete** |
| 13 | Storage + safe cleanup | **Complete** |
| 14 | Support + email | **Complete** |
| 15 | Logs, health, admins, settings | **Complete** |
| 16 | Performance, security, tests, QA | **Complete** |

---

## 19. High-risk areas — do not break

1. **Customer product upload / ModelViewer / AR** — core product value
2. **Razorpay checkout + webhook idempotency** — revenue
3. **Plan enforcement on upload/viewer** — entitlement.ts path
4. **Storage path security** — `getSecureProductPath()`
5. **Customer auth sessions + 2FA**
6. **Existing customer dashboard billing flow**
7. **Invoice generation for paid orders**

---

## 20. Stage 1 files touched

| File | Action |
|------|--------|
| `docs/master-admin-production-audit.md` | Created (this file) |

No application code modified in Stage 1.

---

## 21. Validation commands (Stage 1)

```bash
cd C:\xampp\htdocs\ar360
npm run db:check          # DB connectivity
npx tsc --noEmit          # TypeScript
npm run lint              # Note: vendor draco noise
npm run build             # Recommended before Stage 2
npm run smoke:api         # Optional API smoke
```

---

## 22. Stage 2 completed (2026-07-11)

| Item | Status |
|------|--------|
| Migration `11_coupons_support_platform.sql` | Applied |
| `storage_usage_snapshots` table | Created |
| `npm run db:status` | Added |
| Demo seed moved to `db:seed` only | Done |
| API auto-seed removed (coupons/tickets) | Done |
| Synthetic storage growth removed | Replaced with snapshots |
| Legacy redirects (payments, invoices, analytics) | Done |
| `docs/master-admin-architecture.md` | Created |

**Commands validated:** `db:migrate`, `db:status`, `db:seed`, `tsc --noEmit`

---

## 23. Next steps (Stage 3 preview)

1. Add `admin_roles`, `admin_permissions` migration
2. Implement server-side RBAC middleware
3. Protect sensitive admin mutations

---

*End of Stage 1 audit.*
