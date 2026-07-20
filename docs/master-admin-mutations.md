# Master Admin — Mutations & Pagination (Stage 7)

Stage 7 wires real admin mutations where backend APIs already exist, and moves list modules to **server-side pagination**.

## Shared pagination

**Module:** `src/lib/master-admin/pagination.ts`

Query params:

| Param | Default | Max |
|-------|---------|-----|
| `page` | 1 | — |
| `pageSize` | 10 (8 on subscriptions) | 100 |

Response shape on list APIs:

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 142,
    "totalPages": 15
  }
}
```

**UI:** `AdminPagination` (prev/next + sliding window), `AdminActionMessage` (inline success/error feedback).

## Server-paginated APIs

| Route | Notes |
|-------|--------|
| `GET /api/master-admin/customers` | Filtered count + `LIMIT/OFFSET` |
| `GET /api/master-admin/subscriptions` | Paginated table; summary/analytics from filtered sample (≤500 rows) |
| `GET /api/master-admin/products` | Paginated list; summary via SQL aggregates; `sort=storage\|views` |
| `GET /api/master-admin/billing` | Search moved to SQL; paginated payments |

## Wired mutations

### Customers

| Action | API | Permission |
|--------|-----|------------|
| Suspend / Activate | `PATCH /api/master-admin/customers` | `customers.suspend` |
| Bulk suspend | Same PATCH (loop) | `customers.suspend` |
| Change plan | `PATCH` with `change_plan` | `subscriptions.update` |

**Deferred:** Login as user, hard delete.

### Subscriptions (per customer)

Uses existing `POST /api/master-admin/customers/[id]/subscription`:

| UI action | `action` body |
|-----------|----------------|
| Extend trial (+7 days) | `extend_trial` + `{ hours: 168 }` |
| Cancel | `suspend` |
| Upgrade / Downgrade | Navigate to customer billing |
| Refund | Navigate to billing with email search |

**Deferred:** Generate invoice, send reminder (email integration).

### Products

| Action | API | Permission |
|--------|-----|------------|
| Publish | `PATCH /api/master-admin/products/[id]` `{ action: "publish" }` | `products.update` |
| Archive / Disable | `PATCH` `{ action: "disable" }` | `products.update` |

**Deferred:** Delete, transfer owner.

## Still placeholder (later stages)

- Coupons CRUD
- Support tickets CRUD
- Storage actions
- Customer impersonation
- Customer/product delete

## Pages updated

- `customers/page.tsx` — server pagination, bulk suspend, action messages
- `subscriptions/page.tsx` — server pagination, subscription POST actions
- `products/page.tsx` — server pagination + server sort
- `billing/page.tsx` — server pagination
- `products/[id]/ProductDetailClient.tsx` — publish/archive PATCH

## Validation

```bash
npx tsc --noEmit
```

Manual checks:

1. Customers list paginates; suspend/activate refreshes row.
2. Subscriptions cancel/extend call API and show message.
3. Product detail publish/archive updates status.
4. Billing search + pagination returns consistent totals.
