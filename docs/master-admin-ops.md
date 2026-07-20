# Master Admin — Operations (Stage 15)

Production operations modules: immutable audit logs, paginated activity logs, live system health, admin management, and settings audit trail.

## Audit Logs

**Route:** `/master-admin/audit-logs`  
**API:** `GET /api/master-admin/audit-logs`  
**Permission:** `audit.read` (CSV export also requires `exports.download`)

Reads from `master_admin_audit_logs` with admin name/email joins. Supports:

- Search (action, entity, admin, metadata)
- Filters: `action`, `entityType`, `dateFrom`, `dateTo`
- Pagination: `page`, `pageSize`
- CSV export: `?export=csv`

Audit entries are **immutable** — no delete or edit endpoints.

Actions are written via `writeMasterAdminAudit()` across billing, coupons, storage, support, email, settings, and admin management.

## Activity Logs

**Route:** `/master-admin/activity-logs`  
**API:** `GET /api/master-admin/activity-logs`  
**Permission:** `audit.read`

Platform activity from products and billing payments (union query). Server-side pagination, filters, and CSV export. Client-side delete was removed — logs are read-only.

## System Health

**Route:** `/master-admin/system-health`  
**API:** `GET /api/master-admin/system-health`  
**Permission:** `analytics.read`

Live snapshot with:

- Database ping + latency
- Storage writability and usage %
- SMTP / Razorpay configuration checks
- Support queue and billing failure counts
- Email delivery failures (24h)
- Object capture worker status
- Maintenance mode

Page auto-refreshes every 60 seconds. Public endpoint `/api/health` now includes DB connectivity.

## Admin Management

**Route:** `/master-admin/admins`  
**API:** `GET /api/master-admin/admins`, `PATCH /api/master-admin/admins/[id]`  
**Permission:** `admins.manage`

Lists `master_admins` with RBAC roles from `admin_roles`. Supports:

- Search by name, email, UID
- Filter by status and role
- PATCH: toggle `Active` / `Disabled`, assign `roleId`
- Self-disable protection (cannot disable your own account)
- Audit log on every update (`admin.update`)

Creating new admin accounts is out of scope (requires secure invite/password flow).

## Settings Audit

**API:** `POST /api/master-admin/settings`

Settings save now writes `settings.update` audit entry with changed key names in metadata (secrets are not logged).

## Services

| Service | File |
|---------|------|
| Audit logs | `src/lib/master-admin/audit-logs.service.ts` |
| Activity logs | `src/lib/master-admin/activity-logs.service.ts` |
| System health | `src/lib/master-admin/system-health.service.ts` |
| Admin management | `src/lib/master-admin/admins.service.ts` |

## Permissions Reference

| Permission | Used for |
|------------|----------|
| `audit.read` | Audit + activity logs |
| `exports.download` | CSV exports |
| `analytics.read` | System health |
| `admins.manage` | Admin list / role / status |
| `settings.read` / `settings.manage` | Settings (unchanged) |
