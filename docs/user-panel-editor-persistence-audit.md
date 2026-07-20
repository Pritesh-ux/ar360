# User Panel — Product Editor Persistence Audit (Stage 7)

**Date:** 2026-07-12  
**Scope:** `/dashboard/products/[id]` — `ProductDetailClient.tsx`  
**Status:** Audit complete + persistence fixes applied

---

## Summary

The 3D product editor is **high-risk** — it writes to disk (`product.json`), MySQL (`products`), and generates posters/QR via `/api/products/save-assets`. Stage 7 audited load/save paths and removed **localStorage authority** without changing the save-assets contract.

---

## Canonical Persistence Chain

```
Editor UI (ProductDetailClient)
    ↓
GET /api/products/[id]          ← load (MySQL + product.json merge)
    ↓
POST /api/products/save-assets  ← save / publish / auto-save / poster
    ↓
product-save.service.ts       ← transactional disk + MySQL
    ↓
storage/Customers/{uid}/Products/{productUid}/
```

**Load source of truth:** Server API only (no localStorage fallback).  
**Save source of truth:** `/api/products/save-assets` (unchanged contract).

---

## Issues Found (Before Stage 7)

| Issue | Severity | Location |
|-------|----------|----------|
| Load fell back to localStorage when API failed | High | `loadProduct()` |
| Auto-save wrote to localStorage before API | High | autosave `useEffect` |
| Publish/poster synced via `upsertLocalProduct` | High | `saveAndPublish`, `generatePoster` |
| Cross-tab storage listener overwrote server state | Medium | `handleStorageEvent` |
| `customerUid` from localStorage key | Medium | `getCurrentCustomerUid()` |
| Misleading function name `saveGeneratedAssetsToLocalStorage` | Low | naming |

---

## Fixes Applied

### Load
- **`fetchProductFromApi()`** — API-only load with 8×100ms retry (fresh upload race)
- Removed localStorage fallback and storage event listener
- Session `customerUid` resolved from `/api/customer/bootstrap` ref

### Save / Publish / Auto-save
- All paths call **`saveProductToPublicStorage()` → `/api/products/save-assets`**
- Removed `getLocalProducts`, `upsertLocalProduct`, `getProductById` usage
- Renamed helper to **`saveGeneratedAssets()`**

### Unchanged (intentionally)
- `/api/products/save-assets` request/response contract
- `product-save.service.ts` transactional save
- Editor UI, panels, ModelViewer, undo/redo
- `AppSidebar` on editor route (Stage 4 exception)

---

## Remaining Non-Blocking Items

| Item | Notes |
|------|-------|
| Editor ~1900-line client bundle | Defer split to later refactor |
| Settings JSON in `productPatch` sends full product | Existing behavior; server strips blocked fields |
| No optimistic conflict detection | Last-write-wins via save-assets |
| Public viewer reads separate route | `/viewer/[id]` — not modified |

---

## Verification Checklist

- [x] Load product from API after upload (retry poll)
- [x] Auto-save debounced → save-assets (silent)
- [x] Publish → save-assets with status Published
- [x] Generate poster → save-assets with posterDataUrl
- [x] Native material snapshot → save-assets (silent)
- [x] No localStorage product authority in editor
- [x] `tsc` passes

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/dashboard/products/[id]/ProductDetailClient.tsx` | Persistence audit fixes |
| `docs/user-panel-editor-persistence-audit.md` | This document |

---

## Risks — Do Not Break

- **save-assets contract** — do not rename fields or skip server validation
- **Public viewer** — must read same `product.json` the editor writes
- **QR redirects** — poster/qr generation path unchanged
- **Plan enforcement** — entitlement check on edit remains
