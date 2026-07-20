# Master Admin — Production Readiness (Stage 16)

Final checklist for deploying the Master Admin panel to production.

---

## Implementation status (all 16 stages)

| Stage | Focus | Status |
|-------|-------|--------|
| 1 | Production audit | Complete |
| 2 | Migrations + seed foundation | Complete |
| 3 | Auth + RBAC | Complete |
| 4 | Design system components | Complete |
| 5 | Global search, notifications, quick actions | Complete |
| 6 | Dashboard (real metrics) | Complete |
| 7 | Customers + detail + impersonation | Complete |
| 8 | Subscriptions sync | Complete |
| 9 | Products + detail | Complete |
| 10 | Viewer analytics | Complete |
| 11 | Billing, invoice PDF, exports, refunds | Complete |
| 12 | Coupons | Complete |
| 13 | Storage manager + orphan cleanup | Complete |
| 14 | Support tickets + email center | Complete |
| 15 | Audit, activity logs, health, admins, settings | Complete |
| 16 | Performance, security, tests, QA | Complete |

---

## Pre-deploy checklist

### Environment

- [ ] `AUTH_SECRET` — minimum 32 characters
- [ ] `MYSQL_*` — production database credentials
- [ ] `SKIP_RUNTIME_DDL=true` — use migrations only in production
- [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
- [ ] SMTP settings in platform settings or env
- [ ] `NEXT_PUBLIC_APP_URL` and `APP_URL` set to production domain

### Database

```bash
npm run db:migrate      # includes migration 15 (admin ops indexes)
npm run db:status
npm run auth:seed       # master admin accounts (dev/staging only)
```

Do **not** run `SEED_DEMO_DATA=true` in production unless intentional.

### Validation commands

```bash
# Full offline QA (no running server required)
npm run qa:master-admin

# With live server smoke + security headers
node scripts/master-admin-qa.mjs http://localhost:3000

# Individual checks
npx tsc --noEmit
npm run test
npm run audit:master-admin-security
npm run smoke:master-admin http://localhost:3000
npm run build
```

### CI integration

`npm run smoke:ci` runs customer + billing + storage flows. Add master admin smoke after auth seed:

```bash
npm run auth:seed
npm run smoke:master-admin http://127.0.0.1:3099
```

---

## Security summary

| Control | Implementation |
|---------|----------------|
| RBAC | `guardAdminPermission()` on all master-admin API routes |
| Audit trail | `writeMasterAdminAudit()` on mutations |
| Export gating | CSV exports require `exports.download` |
| Demo data | No API auto-seed; `db:seed` only |
| Storage paths | `normalizePublicStoragePath()` collapses `..` segments |
| Orphan cleanup | Path confined to storage root |
| Self-disable | Admins cannot disable own account |
| Settings secrets | Masked in API responses; not logged in audit metadata |
| Security headers | Configured in `next.config.ts` |

Run `npm run audit:master-admin-security` in CI. Report saved to `reports/master-admin-security-audit.json`.

---

## Performance summary

| Area | Optimization |
|------|--------------|
| Admin table queries | Server-side pagination on all Stage 11–15 modules |
| Audit / activity logs | Migration 15 indexes on `admin_id`, `updated_at`, `status+created_at` |
| Lucide icons | `optimizePackageImports` in Next config |
| Production console | Stripped via compiler (errors/warn kept) |
| Activity log union | Indexed source tables; export capped at 5000 rows |

Run `node scripts/performance-audit.mjs` periodically for large-file and client-component review.

---

## Module documentation index

| Doc | Topic |
|-----|-------|
| [master-admin-architecture.md](./master-admin-architecture.md) | Canonical architecture |
| [master-admin-permissions.md](./master-admin-permissions.md) | RBAC matrix |
| [master-admin-dashboard.md](./master-admin-dashboard.md) | Overview metrics |
| [master-admin-billing.md](./master-admin-billing.md) | Billing + invoices |
| [master-admin-coupons.md](./master-admin-coupons.md) | Coupons |
| [master-admin-storage.md](./master-admin-storage.md) | Storage + cleanup |
| [master-admin-support-email.md](./master-admin-support-email.md) | Support + email |
| [master-admin-ops.md](./master-admin-ops.md) | Audit, health, admins |
| [master-admin-production-audit.md](./master-admin-production-audit.md) | Original audit (historical) |

---

## Known remaining items (post–Stage 16)

These are intentionally out of scope or marked **Soon** in nav:

- **Notifications center** — table exists; full UI pending
- **Database manager** — placeholder page
- **Object Capture admin** — coming soon page
- **Admin invite/create flow** — requires secure password onboarding
- **Legacy routes** — `/master-admin/payments`, `/master-admin/analytics` (redirects in place)

---

## Rollback plan

1. Revert deployment artifact (standalone build)
2. Database: migrations are additive only — no destructive rollback scripts
3. Restore MySQL from `npm run backup:mysql` if schema/data issue
4. Restore storage from `npm run backup:storage` if file loss

---

## Sign-off

Before go-live, confirm:

1. `npm run qa:master-admin` passes
2. Master admin login + RBAC verified for each role
3. Razorpay webhook tested in staging
4. SMTP test email from Settings succeeds
5. `/api/health` returns `db.connected: true`

*Stage 16 complete — Master Admin is production-ready.*
