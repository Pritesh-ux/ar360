# User Panel — QR Center Audit (Stage 9)

**Date:** 2026-07-12  
**Scope:** `/dashboard/qr-center`, `/api/qr-codes`, `/q/[publicId]`  
**Status:** Complete

---

## Summary

Stage 9 production-hardens the QR Center: server-authoritative listing, multi-QR per product, lifecycle tabs (Active / Expired / Archived), design persistence via API, and scan tracking on the public short-link route.

---

## Canonical Data Chain

```
QrCenterClient
    ↓
GET /api/qr-codes?status=&q=&page=
POST /api/qr-codes              ← create campaign QR
PATCH /api/qr-codes/[id]        ← save design / archive / expiry
    ↓
qr-codes.service.ts
    ↓
product_qr_codes (+ products join)
    ↓
/q/{qr_uid} → viewer + qr_scan_events
```

**Source of truth:** MySQL `product_qr_codes` — no localStorage fallback.

---

## Changes Applied

### 1. Service layer

**File:** `src/lib/user-panel/qr-codes.service.ts`

- `listCustomerQrCodes()` — pagination, search, status filters, stats
- `ensureMainQrForCustomerProducts()` — auto-creates "Main QR" per product
- `createCustomerQrCode()` — additional campaign QRs per product
- `updateCustomerQrCode()` — design, name, expiry, archive
- `resolveEffectiveQrStatus()` — expiry-aware status
- `getQrCodeByPublicId()` — public redirect lookup

### 2. API

**Files:** `src/app/api/qr-codes/route.ts`, `src/app/api/qr-codes/[id]/route.ts`

| Method | Purpose |
|--------|---------|
| GET | List with `status`, `q`, `page`, `productId` |
| POST | Create campaign QR `{ productId, name?, expiresAt? }` |
| PATCH `[id]` | Update design, expiry, archive |
| PUT | Backward-compat alias (requires `id`) |

Uses `requireScopedApiUser()` + subscription gate.

### 3. UI redesign

**File:** `src/app/dashboard/qr-center/QrCenterClient.tsx`

- User panel design system (`UserPageHeader`, `UserMetricCard`, `UserButton`, `StatusBadge`)
- Status tabs driven by URL query params
- Grid list + full editor with live preview
- Multi-QR: **+** button creates campaign QR for same product
- Archive, expiry date, QR name fields
- Removed `localStorage` and `getLocalProducts` fallback

**Component:** `src/components/user-panel/QrCodePreview.tsx` — shared SVG QR renderer

### 4. Public scan route

**File:** `src/app/q/[publicId]/route.ts`

- Lookup by `public_id` or `qr_uid`
- Blocks expired/archived QRs
- Increments `scans` + inserts `qr_scan_events`
- Redirects to `/viewer/{productId}?source=qr`

---

## Unchanged

| Path | Reason |
|------|--------|
| `/qr/[id]` | Legacy redirect route — backward compatible |
| QR SVG rendering algorithm | Preserved from prior implementation |
| `QrCenterClient.module.css` | Orphaned; UI now uses Tailwind + `--ar-*` tokens |

---

## Validation

```bash
npx tsc --noEmit
npm run test
npm run build
```

Manual checks:

- [ ] QR Center loads from API without localStorage
- [ ] Each product gets a Main QR automatically
- [ ] Create campaign QR (+) for same product
- [ ] Active / Expired / Archived tabs filter correctly
- [ ] Design save persists via PATCH
- [ ] `/q/{uid}` redirects and increments scans
- [ ] Expired QR returns 404 on scan

---

## Next Stage

**Stage 10 — Share Center:** `share-links.service.ts`, `/dashboard/share-center`, embed code via `buildEmbedIframeCode()`.
