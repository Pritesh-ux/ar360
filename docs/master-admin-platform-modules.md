# Master Admin — Platform Modules (Stage 8)

Stage 8 adds **CRUD and operational mutations** for coupons, support tickets, and storage management.

## Migration

| File | Purpose |
|------|---------|
| `database/migrations/14_support_ticket_messages.sql` | Ticket reply thread table |

Runtime DDL mirror: `ensureSupportTicketsSchema()` also creates `support_ticket_messages`.

## Coupons

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/master-admin/coupons` | `coupons.read` |
| POST | `/api/master-admin/coupons` | `coupons.manage` |
| GET | `/api/master-admin/coupons/[id]` | `coupons.read` |
| PATCH | `/api/master-admin/coupons/[id]` | `coupons.manage` |

**Service:** `src/lib/master-admin/coupons.service.ts`

**UI:** `CouponFormModal` — create/edit; disable via confirm modal; server pagination.

## Support tickets

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/master-admin/support-tickets` | `tickets.read` |
| POST | `/api/master-admin/support-tickets` | `tickets.manage` |
| GET | `/api/master-admin/support-tickets/[id]` | `tickets.read` |
| PATCH | `/api/master-admin/support-tickets/[id]` | `tickets.manage` |

**PATCH fields:** `status`, `priority`, `assignedTo`, `reply` (creates admin message)

**Service:** `src/lib/master-admin/support-tickets.service.ts`

**UI:** `TicketDetailModal` — view thread, assign, change status, reply.

## Storage operations

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/master-admin/storage` | `storage.read` |
| POST | `/api/master-admin/storage` | `storage.cleanup` |

**POST actions:**

| `action` | Behavior |
|----------|----------|
| `cleanup` | Remove temp/cache files (`admin-cleanup.ts`) |
| `scan_orphans` | List disk folders without DB products |
| `delete_orphans` | Delete scanned orphan folders |

**UI:** Confirm modals before cleanup/delete; `AdminActionMessage` feedback.

## Still deferred (Stage 9+)

- Customer impersonation
- Customer/product hard delete
- Billing email send (invoice reminder)
- Product transfer owner
- Admin-created support tickets from UI (POST API exists; form UI optional)

## Validation

```bash
npx tsc --noEmit
# Apply migration if not yet run:
# mysql ... < database/migrations/14_support_ticket_messages.sql
```

Manual checks:

1. Create/edit/disable coupon from Coupons page.
2. Open ticket → reply → status change persists.
3. Storage cleanup returns file count; orphan scan shows count before delete.
