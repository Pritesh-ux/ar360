# User Panel — Public Viewer Audit (Stage 8)

**Date:** 2026-07-12  
**Scope:** `/viewer/[id]`, `/embed/[id]`, `/qr/[id]` (redirect only)  
**Status:** Audit complete + persistence fixes applied

---

## Summary

The public viewer is **high-traffic** and must load published products from the server only. Stage 8 removed localStorage authority from the viewer and embed routes, unified product loading via a shared hook, aligned accent colors to `--ar-*` tokens, and simplified analytics to server-only ingestion.

---

## Canonical Load Chain

```
/viewer/[id]  → PublicViewerPage
/embed/[id]   → EmbedViewerPage
/qr/[id]      → redirect → /viewer/[id]?source=qr
    ↓
usePublicViewerProduct (src/lib/user-panel/public-viewer.ts)
    ↓
fetchPublicProduct → GET /api/public-products/[id]
    ↓
MySQL + disk (product.json, assets)
```

**Load source of truth:** `/api/public-products/[id]` only — no localStorage merge or cache write-back.

---

## Issues Found (Before Stage 8)

| Issue | Severity | Location |
|-------|----------|----------|
| Public viewer merged localStorage product over API | High | `PublicViewerPage.tsx` load effect |
| Embed page used `findViewerProduct` localStorage fallback | High | `embed/[id]/page.tsx` |
| `recordViewerEvent` wrote analytics to localStorage | Medium | `universal-viewer.ts` |
| Cyan accent `#00B2CA` instead of design tokens | Low | `PublicViewerPage.tsx` |

---

## Changes Applied

### 1. Shared public viewer module

**File:** `src/lib/user-panel/public-viewer.ts`

- `loadPublicViewerProduct()` — API-only fetch with optional retry
- `usePublicViewerProduct()` — React hook for viewer/embed pages
- `getPublicViewerUrl()`, `getEmbedViewerUrl()`, `buildEmbedIframeCode()` — share/embed helpers

### 2. Public viewer page

**File:** `src/components/features/viewer/PublicViewerPage.tsx`

- Replaced inline load + localStorage merge with `usePublicViewerProduct`
- Removed imports from `@/lib/clientProducts` and localStorage reads
- `viewer_open` analytics tracked once via hook (not duplicated)
- Accent colors updated to `var(--ar-primary)`, `var(--ar-primary-hover)`, `var(--ar-primary-soft)`

### 3. Embed viewer

**File:** `src/components/features/viewer/EmbedViewerPage.tsx` (new)  
**Route:** `src/app/embed/[id]/page.tsx` — thin Suspense wrapper

- API-only load via `usePublicViewerProduct` with `trackEvent: "open_embed"`
- Password/expiry/embed-disabled states preserved
- Uses shared `checkViewerAccess`, `getActiveViewerSettings`, `ModelViewer`

### 4. Analytics

**File:** `src/lib/universal-viewer.ts`

- `recordViewerEvent()` now calls `trackAnalyticsEvent()` only
- Removed `ar_analytics_events` and `ar_analytics_summary` localStorage writes

### 5. Route wrappers

**Files:** `src/app/viewer/[id]/page.tsx`, `src/app/embed/[id]/page.tsx`

- Added `Suspense` boundaries for `useSearchParams` compatibility

---

## Unchanged (Intentionally)

| Path | Reason |
|------|--------|
| `/api/public-products/[id]` | Working public API — no contract change |
| `/qr/[id]` | Redirect-only — no load logic |
| AR button / ModelViewer | Feature-complete — UI not rewritten |
| `findViewerProduct`, `getProductsFromStorage` in universal-viewer | Legacy helpers; no longer used by viewer routes |
| `incrementViewerViewCount` localStorage | Out of Stage 8 scope; dashboard uses server analytics |

---

## Validation

```bash
npx tsc --noEmit
npm run test
npm run build
```

Manual checks:

- [ ] `/viewer/{publicId}` loads published product from API
- [ ] `/embed/{publicId}` renders model without localStorage
- [ ] `/qr/{publicId}` redirects with `?source=qr`
- [ ] Password-protected / expired / unpublished states show correct UI
- [ ] AR button still launches on `?openAR=1`
- [ ] Share/copy/screenshot events still reach analytics API

---

## Next Stages

- **Stage 9+:** Share center may consume `buildEmbedIframeCode()` from public-viewer module
- **Stage 15:** Settings double-sidebar follow-up
