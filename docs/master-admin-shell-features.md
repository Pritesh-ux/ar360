# Master Admin Shell Features (Stage 5)

Global search, notifications bell, and quick actions drawer for the master admin shell.

---

## APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/master-admin/search?q=` | GET | Cross-domain search (customers, products, payments, tickets) |
| `/api/master-admin/notifications` | GET | List notifications + unread count |
| `/api/master-admin/notifications` | PATCH | Mark read `{ ids: [] }` or `{ markAll: true }` |
| `/api/master-admin/me` | GET | Admin session + permissions (Stage 3) |

### Search

- Minimum query length: **2 characters**
- Debounced client fetch (250ms)
- Keyboard: **⌘/Ctrl + K** opens palette; ↑↓ navigate; Enter opens result; Esc closes
- Permission: any of `customers.read`, `products.read`, `billing.read`, `tickets.read`

### Notifications

- Table: `admin_notifications` (migration 13)
- Derived alerts synced on each GET from live platform data:
  - Failed payments (7 days)
  - High-priority open tickets
  - New customers (24h)
  - Pending payments (30 days)
- Bell badge shows real unread count (polls every 60s)
- Permission: any of `analytics.read`, `customers.read`, `billing.read`, `tickets.read`

---

## UI components

| Component | Location |
|-----------|----------|
| `AdminGlobalSearch` | Command palette modal |
| `AdminNotificationsPanel` | Bell dropdown |
| `AdminQuickActionsDrawer` | Right slide-over |
| `AdminTopBar` | Search trigger, bell, quick actions button |
| `MasterAdminShell` | Wires session, permissions, mobile actions tab |

---

## Quick actions

Defined in `src/components/features/master-admin/nav.ts` with optional `permissions[]`.

Filtered client-side via `filterQuickActionsByPermissions()` using `/api/master-admin/me`.

Triggers:
- Top bar **Quick Actions** button
- Sidebar **Quick Actions** button (+ top 4 links when expanded)
- Mobile bottom nav **Actions** tab

---

## Database

```bash
npm run db:migrate   # applies 13_admin_notifications.sql
```

---

*End of Stage 5 shell features doc.*
