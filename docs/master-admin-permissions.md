# Master Admin Permissions (RBAC)

**Stage 3 baseline** — server-side role-based access control for the master admin panel.

---

## Overview

Master admin access uses two layers:

1. **Authentication** — valid session cookie (`ar360_master_admin_session`) and active `master_admins` row (`requireAdmin`, `requireApiAdmin`).
2. **Authorization** — role + permission checks on every sensitive API route (`guardAdminPermission`).

UI button hiding is not sufficient; all mutations and data reads go through guarded API routes.

---

## Database tables

| Table | Purpose |
|-------|---------|
| `admin_roles` | Named roles (`super_admin`, `billing_admin`, …) |
| `admin_permissions` | Permission catalog (`customers.read`, `billing.refund`, …) |
| `admin_role_permissions` | Many-to-many role → permission |
| `master_admins.role_id` | Each admin has one role |

Migration: `database/migrations/12_admin_rbac.sql`

---

## Default roles

| Code | Name | Typical use |
|------|------|-------------|
| `super_admin` | Super Admin | Full access; bypasses permission checks in code |
| `operations_admin` | Operations Admin | Customers, products, storage |
| `billing_admin` | Billing Admin | Payments, refunds, subscriptions |
| `support_admin` | Support Admin | Tickets + customer read |
| `content_admin` | Content Admin | Product catalog |
| `analytics_viewer` | Analytics Viewer | Read-only reporting |
| `read_only` | Read Only | All `*.read` permissions |

Existing admins without a role are auto-assigned `super_admin` during migration/seed.

---

## Permission catalog

| Permission | Category | Description |
|------------|----------|-------------|
| `customers.read` | customers | List/view customers |
| `customers.update` | customers | Edit customer fields |
| `customers.suspend` | customers | Suspend/reactivate accounts |
| `customers.delete` | customers | Delete accounts |
| `customers.impersonate` | customers | Impersonate customer (future) |
| `subscriptions.read` | subscriptions | View subscriptions |
| `subscriptions.update` | subscriptions | Change plans/status |
| `subscriptions.cancel` | subscriptions | Cancel subscriptions |
| `billing.read` | billing | View payments/invoices |
| `billing.refund` | billing | Issue refunds |
| `billing.manual_payment` | billing | Record manual payments |
| `invoices.generate` | billing | Generate invoices |
| `products.read` | products | View products |
| `products.update` | products | Edit products |
| `products.delete` | products | Delete products |
| `storage.read` | storage | View storage usage |
| `storage.cleanup` | storage | Run cleanup/repair |
| `coupons.read` | coupons | View coupons |
| `coupons.manage` | coupons | CRUD coupons |
| `tickets.read` | support | View tickets |
| `tickets.manage` | support | Manage tickets |
| `analytics.read` | analytics | Viewer/platform analytics |
| `admins.manage` | admins | Manage admin users (future) |
| `settings.read` | settings | View platform settings |
| `settings.manage` | settings | Update platform settings |
| `audit.read` | audit | Login/activity logs |
| `exports.download` | exports | CSV/report downloads |

---

## Application API

| Module | File |
|--------|------|
| Permission types + matrix | `src/lib/permissions/admin-permissions.ts` |
| Guards + DB resolution | `src/lib/permissions/admin-rbac.ts` |
| Re-exports | `src/lib/permissions/index.ts` |

### Guard usage (API routes)

```typescript
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export async function GET() {
  const auth = await guardAdminPermission("customers.read");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  // ...
}
```

Multiple permissions (any match):

```typescript
await guardAdminPermission(["billing.read", "exports.download"]);
```

### Current admin + permissions

`GET /api/master-admin/me` returns `{ admin: { id, email, roleCode, permissions[] } }`.

### Page-level guard (optional)

```typescript
import { requireAdminPermission } from "@/lib/permissions/admin-rbac";

await requireAdminPermission("settings.manage"); // redirects if forbidden
```

---

## Route → permission map

| API route | Permission |
|-----------|------------|
| `GET /api/master-admin/customers` | `customers.read` |
| `PATCH /api/master-admin/customers` | `customers.suspend` / `subscriptions.update` |
| `GET /api/master-admin/customers/[id]` | `customers.read` |
| `GET/POST …/customers/[id]/subscription` | `subscriptions.read` / `subscriptions.update` |
| `GET /api/master-admin/subscriptions` | `subscriptions.read` |
| `GET /api/master-admin/billing` | `billing.read` |
| `GET/POST/PUT /api/master-admin/payments` | `billing.read` / `billing.manual_payment` |
| `POST …/payments/[id]/refund` | `billing.refund` |
| `GET …/billing/invoices/[id]/download` | `billing.read` or `exports.download` |
| `GET/PUT …/billing/plans` | `billing.read`/`settings.read` / `settings.manage` |
| `GET/PUT …/billing/customers/[uid]/plan` | `subscriptions.read` / `subscriptions.update` |
| `GET /api/master-admin/products` | `products.read` |
| `GET /api/master-admin/storage` | `storage.read` |
| `GET /api/master-admin/storage-meta` | `storage.read` |
| `GET …/storage/product-json-audit` | `storage.read` / `storage.cleanup` (write=1) |
| `GET /api/master-admin/coupons` | `coupons.read` |
| `GET /api/master-admin/support-tickets` | `tickets.read` |
| `GET /api/master-admin/viewer-analytics` | `analytics.read` |
| `GET /api/master-admin/dashboard` | `analytics.read` |
| `GET /api/master-admin/live?kind=` | `analytics.read` or `audit.read` |
| `GET/POST /api/master-admin/settings` | `settings.read` / `settings.manage` |
| `POST …/settings/test-email` | `settings.manage` |

Panel pages under `/master-admin/*` still require login via layout `requireAdmin()`. Data access is enforced at the API layer.

---

## Seed & migration

```bash
npm run db:migrate   # applies 12_admin_rbac.sql
npm run db:seed      # assigns super_admin to admins without role_id
npm run db:status    # verify 12/12 migrations
```

---

## Rollout notes

- Admins with `role_id = NULL` receive full access until migration runs (backward compatible).
- After migration, all existing admins are assigned `super_admin`.
- Permission cache TTL: 30 seconds per admin (`clearAdminPermissionCache()` available after role changes).
- Customer dashboard auth is unchanged; RBAC applies only to master admin routes.

---

*End of Stage 3 permissions doc.*
