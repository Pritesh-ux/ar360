# Master Admin — Coupons (Stage 12)

Stage 12 production-hardens the **Coupons & Promotions** module with server-side validation, filtered analytics, CSV export, redemption history, duplicate/activate actions, and audit logging.

## Canonical sources

| Layer | Path |
|-------|------|
| Service | `src/lib/master-admin/coupons.service.ts` |
| API list | `GET/POST /api/master-admin/coupons` |
| API detail | `GET/PATCH /api/master-admin/coupons/[id]` |
| Redemptions | `GET /api/master-admin/coupons/[id]/redemptions` |
| Page | `src/app/master-admin/(panel)/coupons/page.tsx` |
| Form modal | `CouponFormModal.tsx` |
| Redemptions modal | `CouponRedemptionsModal.tsx` |

## API

### `GET /api/master-admin/coupons`

| Param | Purpose |
|-------|---------|
| `search` | Code or description |
| `status` | `active`, `expired`, `disabled`, or `all` |
| `type` | `percentage`, `fixed`, `free_trial`, or `all` |
| `createdFrom`, `createdTo` | Coupon creation date range |
| `validFrom`, `validTo` | Expiry date range |
| `page`, `pageSize` | Server pagination |
| `export=csv` | Download filtered CSV (max 5000 rows) |

**Permission:** `coupons.read` (export also requires `exports.download`)

### `POST /api/master-admin/coupons`

Creates a coupon with server validation and audit log `coupon.create`.

**Permission:** `coupons.manage`

### `PATCH /api/master-admin/coupons/[id]`

| Body | Purpose |
|------|---------|
| `{ action: "disable" }` | Disable coupon |
| `{ action: "activate" }` | Re-enable disabled coupon |
| `{ action: "duplicate" }` | Clone with unique `-COPY` code |
| Field updates | Edit code, discount, limits, expiry, status |

**Permission:** `coupons.manage`

### Redemptions

`GET /api/master-admin/coupons/[id]/redemptions`

Returns recent rows from `coupon_redemptions` joined with customer info.

## Validation (server-side)

- Unique normalized uppercase code
- Percentage: 1–100
- Fixed amount: > 0
- Free trial: positive whole number of days
- Usage limit ≥ 0
- Valid expiry date when provided

## Metrics (database-driven)

### Summary KPIs (respect active filters)
- Active / expired coupon counts
- Total usage (`usage_count` sum)
- **Customer Discounts** — cumulative `revenue_saved_paise` (labeled correctly; not platform revenue)

### Charts
- **Coupon Types** — donut from filtered coupons
- **Top Performing** — by `usage_count`
- **Customer Discounts chart** — daily sum from `coupon_redemptions` (last 30 days or selected created range)

No fake trend percentages or decorative sparklines.

## UI improvements

- Stat cards show real subtitles instead of hardcoded `+14.3%` trends
- Created-date range filters + “Last 30 days” preset
- Server CSV export with current filters
- Row actions: redemptions, duplicate, edit, activate/disable
- Quick actions: create, export, view redemptions
- `CouponRedemptionsModal` for redemption history

## Audit actions

- `coupon.create`, `coupon.update`, `coupon.disable`, `coupon.activate`, `coupon.duplicate`

## Validation

```bash
npx tsc --noEmit
```

Manual checks:
1. Open `/master-admin/coupons` — KPIs and table load from DB (no auto-seed).
2. Create/edit coupon — validation errors for invalid percentage.
3. Duplicate coupon — new `-COPY` code appears.
4. Disable then activate — status toggles.
5. View redemptions — modal loads from `coupon_redemptions`.
6. Export CSV — download honors filters.
