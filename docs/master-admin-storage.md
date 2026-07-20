# Master Admin — Storage Manager (Stage 13)

Stage 13 production-hardens the **Storage Manager** with real per-plan warning thresholds, snapshot-based growth trends, server CSV export, safe orphan cleanup workflow, and audit logging.

## Canonical sources

| Layer | Path |
|-------|------|
| Service | `src/lib/master-admin/storage.service.ts` |
| Cleanup / orphans | `src/lib/storage/admin-cleanup.ts` |
| Platform scan | `src/lib/storage/platform-audit.ts` |
| Snapshots | `src/lib/storage/snapshots.ts` |
| API | `GET/POST /api/master-admin/storage` |
| Page | `src/app/master-admin/(panel)/storage/page.tsx` |
| Orphan modal | `OrphanScanModal.tsx` |

## API

### `GET /api/master-admin/storage`

| Param | Purpose |
|-------|---------|
| `search` | Customer name, email, plan, company |
| `page`, `pageSize` | Top storage users pagination |
| `growthDays` | Storage growth chart range (7–90 days) |
| `export=csv` | Download filtered storage report (max 5000 rows) |

**Permission:** `storage.read` (export also requires `exports.download`)

### `POST /api/master-admin/storage`

| `action` | Behavior |
|----------|----------|
| `cleanup` | Remove temp/cache files older than 7 days |
| `scan_orphans` | List disk product folders with no DB record |
| `delete_orphans` | Delete orphans (re-scans server-side; optional `orphanPaths` filter) |

Body: `{ action, dryRun?, orphanPaths?: string[] }`

**Permission:** `storage.cleanup`

## Safe orphan cleanup workflow

1. **Scan** — `scan_orphans` compares disk folders under `{customerUid}/Products/{productUid}` against `products` table
2. **Review** — `OrphanScanModal` shows count, total bytes, and folder list
3. **Confirm delete** — `delete_orphans` re-scans, validates paths stay under storage root, deletes with `fs.rm({ recursive: true })`
4. **Audit** — `storage.scan_orphans`, `storage.delete_orphans`, `storage.cleanup`

Path safety: all deletes pass `resolveUnderStorageRoot()` — paths outside the storage root are rejected.

Temp cleanup only targets files in `temp`, `cache`, `.cache` folders or matching temp filename patterns.

## Metrics (database-driven)

### Summary
- Total / used / free storage (platform cap from `PLATFORM_STORAGE_TB`)
- Bandwidth used vs monthly limit
- **Warnings / critical** — per-customer `% used` vs **their plan limit** (not hardcoded 5120 MB)
- **Trends** — compare current usage vs prior snapshot period

### Charts
- **Storage Growth** — `storage_usage_snapshots` (daily upsert on page load)
- **File Type Breakdown** — bounded disk scan via `scanPlatformStorage`
- **Largest Files** — top files from scan, enriched with customer/product names

### Tables
- Top storage users, largest files, storage by plan, recent uploads

Bandwidth is labeled as estimated from customer `bandwidth_used_mb` totals.

## UI improvements

- Removed fake `+12.6%` / `+18.4%` trend strings
- Date range drives `growthDays` for the growth chart
- Server CSV export replaces client-only current-page export
- Orphan scan → review modal → confirm delete (no blind delete)
- Settings link to `/master-admin/settings`

## Audit actions

- `storage.cleanup`, `storage.cleanup_dry_run`
- `storage.scan_orphans`
- `storage.delete_orphans`, `storage.delete_orphans_dry_run`

## Validation

```bash
npx tsc --noEmit
```

Manual checks:
1. Open `/master-admin/storage` — KPIs, charts, tables load.
2. Change date range — growth chart refreshes.
3. Export CSV — download includes all filtered customers.
4. Scan orphans — modal shows results before delete.
5. Run cleanup — temp files removed; audit logged.
6. Warning/critical counts reflect per-plan limits.
