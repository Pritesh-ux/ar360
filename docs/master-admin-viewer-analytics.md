# Master Admin — Viewer Analytics (Stage 10)

Stage 10 production-hardens the **Viewer Analytics** module with real metrics, period comparisons, filters, pagination, and CSV export.

## Canonical sources

| Layer | Path |
|-------|------|
| Service | `src/lib/master-admin/viewer-analytics.service.ts` |
| API | `GET /api/master-admin/viewer-analytics` |
| Page | `src/app/master-admin/(panel)/viewer-analytics/page.tsx` |
| Repository | `src/server/analytics/analytics.repository.ts` |

## API

| Param | Purpose |
|-------|---------|
| `from`, `to` | Date range (default: last 30 days) |
| `customerUid` | Filter by customer |
| `productUid` | Filter by product |
| `search` | Product title, ID, owner name/email |
| `page`, `pageSize` | Product ranking pagination |
| `export=csv` | Download product ranking CSV |

**Permission:** `analytics.read`

## Metrics (database-driven)

### Summary KPIs
- Total views, AR opens, QR scans — from `analytics_events` with `analytics_daily` fallback
- Unique visitors — distinct `ip_hash` in range
- Avg session duration — `analytics_sessions.duration`
- Bounce rate — single-event sessions / total sessions

### Period trends
Compares selected range vs **equal-length prior period** (no hardcoded `+18%` labels).

### Realtime strip
- Active viewers — distinct sessions in last 5 minutes
- Views last hour — viewer open events in last hour

### Charts
- **Daily views** — `analytics_daily` series for selected range
- **Monthly views** — 12-month rollup from `analytics_daily`
- **Device / browser / country** — event breakdowns
- **Traffic sources** — referrer breakdown

### Product ranking table
- Server-paginated from `analytics_events`
- Per-product views, AR, QR, session avg, bounce rate, share %
- No fake trend strings; no fallback to `products.views` when events empty

## UI improvements

- Default 30-day range
- Filter panel (search, customer UID, product UID)
- Live + unique visitor cards
- Traffic sources panel (was missing)
- Removed decorative fake country map
- CSV export via API (`export=csv`)
- `AdminPagination` on product table
- `AdminLoadingState` / `AdminActionMessage`

## Validation

```bash
npx tsc --noEmit
```

Manual checks:
1. Open `/master-admin/viewer-analytics` — KPIs load from DB.
2. Change date range — charts and table refresh.
3. Filter by customer/product — ranking narrows.
4. Export CSV — downloads filtered product ranking.
5. With no events — empty states, zero KPIs (no fake numbers).
