# Master Admin Dashboard (Stage 6)

Real metrics dashboard powered by MySQL — no hardcoded KPIs or mock geography.

---

## Canonical data source

| Layer | Path |
|-------|------|
| Service | `src/lib/master-admin/dashboard.service.ts` |
| Re-export | `src/lib/master-admin-real.ts` |
| API | `GET /api/master-admin/dashboard` |
| Page | `src/app/master-admin/(panel)/page.tsx` |

Server page and API both call `getMasterAdminDashboardData()`.

---

## Metrics (all database-driven)

### Overview KPIs
- Total / monthly revenue from `billing_payments` + `billing_invoices`
- Active customers, subscriptions, products from respective tables
- Storage & bandwidth sums from `customers`
- 7-day sparklines per KPI (14-day revenue/customer trend %)

### Today strip
- Uploads (`products.created_at`)
- AR views & QR scans (`analytics_daily`)
- Failed payments today (`billing_payments`)

### Charts (30 days)
- Revenue growth (daily captured payments)
- Customer growth (daily signups)

### Breakdowns
- **Top countries** — `customers.country` grouped
- **Plan distribution** — `customer_subscriptions` + `customers.plan_id`
- **Top products** — `products.views` + `analytics_daily.ar_launches`

### Live activity
- Recent logins (15 min) — `auth_login_logs`
- Products updated today
- Object capture jobs in progress — `object_capture_jobs`
- Open support tickets — `support_tickets`

### System health (computed)
- Database connectivity
- Storage path writable + utilization vs 10 TB cap
- Razorpay / SMTP configuration from `platform_settings`
- Failed payments (7d), high-priority tickets, maintenance mode
- Object capture table availability

---

## Permissions

- Page: `requireAdminPermission("analytics.read")`
- API: `guardAdminPermission("analytics.read")`

---

## UI components

- `AdminMetricCard` with real sparkline arrays
- `AdminMiniBarChart` — 30-day bar charts
- `AdminPlanBreakdownChart` — plan distribution
- `AdminHealthBadge` — health status chips

---

*End of Stage 6 dashboard doc.*
