# Gem Renderer — AR360 Studio Integration Report

**Branch:** `feat/gem-renderer-integration`  
**Status:** Staging-safe integration scaffold (feature-flagged OFF in production)  
**POC preserved:** `/experiments/gem-renderer` unchanged for engineering diagnostics

---

## 1. ModelViewer integration point

**File:** `src/components/shared/ModelViewer.tsx`

- Existing `<model-viewer>` load path unchanged (`handleLoad` → `onMaterialsLoaded`).
- Wrapped in `relative` container with internal `GemRendererOverlay` sibling canvas.
- New optional props: `productId`, `variantId`, `environmentRotation`.
- On `runtimeSrc` / `productId` change: `deactivateGemProduct()` disposes GPU session.
- When `isGemRendererActiveForProduct()` is true, legacy `gemstone-optics-approx` is skipped for gemstone slots (PBR metal/band unaffected).

## 2. GemRenderer integration point

**Files:**
- `src/lib/gem-renderer-poc/GemRenderer.ts` — `integration: true` mode
- `src/lib/gem-integration/gemModelViewerBridge.ts` — orchestrator
- `src/components/shared/GemRendererOverlay.tsx` — React overlay

**Flow:**
```
ModelViewer GLB loaded (single fetch)
  → three.js scene available
  → GemRendererOverlay.attachGemBridge()
  → analyzeObject3D + evaluateGemSuitability (active product only)
  → SUPPORTED: packFromSceneMesh() — no second GLB fetch
  → hide primary gem mesh in model-viewer
  → overlay canvas renders gem; camera synced from model-viewer
```

New GemRenderer APIs:
- `prepareForIntegration(envUrl)`
- `packFromSceneMesh(mesh, key, label, reportPrim)` — preserves world transform
- `syncExternalCamera(threeCamera)`

## 3. Asset loading lifecycle

| Stage | What loads |
|-------|------------|
| Dashboard catalog | Thumbnails + metadata only (unchanged `ProductsClient`) |
| Product open | Single GLB via model-viewer (existing path) |
| Gem gate | Lightweight `analyzeObject3D` on loaded scene |
| Gem init | GPU pack + BVH via queue (`AssetLoadQueue`) |
| Product switch | Cancel pending jobs, dispose warm cache, deactivate session |
| AR / QR | Same single-product lazy path; no catalog preload |

## 4. Cache / LRU design

**File:** `src/lib/gem-integration/boundedResourceCache.ts`

- **ACTIVE:** pinned key — never evicted while selected
- **WARM:** max 1 entry, 64–128 MB soft budget
- **COLD:** metadata/thumbnails only (dashboard)

Eviction calls explicit `dispose()` on GemRenderer sessions.

## 5. GPU disposal strategy

On product switch / unmount:
- `deactivateGemProduct(productId)` cancels queue jobs
- `restoreHiddenMeshes()` — model-viewer gem mesh visibility restored
- `GemRenderer.dispose()` — geometries, materials, textures, RTs, BVH
- LRU evicts oldest warm entry when budget exceeded

## 6. Concurrency limit

**File:** `src/lib/gem-integration/assetLoadQueue.ts`

- Mobile: **1** concurrent heavy job
- Desktop: **2** concurrent heavy jobs
- Priority: active product (100) > prefetch (1)

## 7. Mobile memory strategy

- Queue concurrency = 1 on mobile UA
- Warm cache max 1 entry
- No prefetch blocking active load
- Production quality: **MOBILE LOW** (1 spp, 3 λ, 4 bounces, 50% internal res)
- Quality reduction only via existing AUTO controller under frame pressure — not from catalog size

## 8. Multiple-gem strategy

Phase 1 (this branch):
- One **primary** supported gem per product via GemRenderer
- Additional gem meshes remain on existing PBR / gemstone-optics path
- Shared per session: environment, shader programs, quality tier, GemRenderer instance

Future: multi-mesh packing into shared triangle/BVH buffers (architecture slot reserved in bridge `candidates[]`).

## 9. Variation reuse strategy

- `variantId` passed to overlay; geometry reload only when `modelUrl` changes
- Variant material / color / env changes reuse loaded GLB (existing ModelViewer behavior)
- `key={id}` on editor canvas remounts on product navigation — disposes prior session

## 10. AR integration path

**Unchanged.** AR uses baked GLB/USDZ URLs via existing `ARExperienceProButton` / `ar-experience.ts`. GemRenderer overlay is Canvas-only; AR handoff not modified.

## 11. QR / share path

**Unchanged.** `PublicViewerPage` lazy-loads configured product via `usePublicViewerProduct` + single `ModelViewer`. Integration props added (`productId`, `variantId`). No catalog preload.

## 12. Fallback path

| Suitability | Behavior |
|-------------|----------|
| UNSUPPORTED | No GemRenderer init; existing PBR + gemstone-optics |
| SUPPORTED / SUPPORTED_WITH_WARNING | GemRenderer overlay |
| Init / shader failure | `bridgeState.mode = 'error'`; model-viewer remains usable |
| Feature flag off | Zero integration overhead |

Feature gate: `src/lib/gem-integration/featureFlags.ts`  
- OFF by default in production  
- ON when `NEXT_PUBLIC_GEM_RENDERER_INTEGRATION=1` or staging hostname

## 13. 100-product stress test results

**Script:** `scripts/gem-integration-stress.mjs`

Run locally:
```bash
node scripts/gem-integration-stress.mjs
```

Validates (simulated):
- 100 catalog entries → **0** startup GLB fetches
- Peak concurrent loads ≤ 2
- Cache bounded after product switch
- Explicit dispose on eviction

**Note:** Browser GPU/FPS acceptance (items A–D) requires manual staging verification with real products — not claimed as automated pass in this report.

## 14. Files changed (integration branch)

| Path | Role |
|------|------|
| `src/lib/gem-integration/*` | Queue, cache, detection, bridge, env |
| `src/lib/gem-renderer-poc/GemRenderer.ts` | Integration mode APIs |
| `src/components/shared/GemRendererOverlay.tsx` | Overlay canvas |
| `src/components/shared/ModelViewer.tsx` | Minimal hook |
| `src/app/dashboard/.../ProductDetailClient.tsx` | productId pass-through |
| `src/components/features/viewer/PublicViewerPage.tsx` | productId pass-through |
| `scripts/gem-integration-stress.mjs` | Stress test |
| `reports/GEM_INTEGRATION_REPORT.md` | This report |

## 15. Production files touched

Production-adjacent (feature-flagged, default OFF):
- `ModelViewer.tsx`
- `ProductDetailClient.tsx`
- `PublicViewerPage.tsx`
- `GemRenderer.ts` (additive integration APIs — POC route unaffected)

POC-only files **not** exposed to customers: `/experiments/gem-renderer/*`

## 16. Staging URL

Deploy `feat/gem-renderer-integration` to staging for validation:

- Dashboard canvas: `https://staging.ar360studio.com/dashboard/products/{id}`
- Engineering POC (unchanged): `https://staging.ar360studio.com/experiments/gem-renderer`

Gem integration auto-enables on `staging.*` hostname per feature flag.

## 17. Remaining risks

1. **Camera alignment** — relies on model-viewer internal Three.js camera symbol; needs device QA on iPhone Safari.
2. **Multi-gem** — only primary gem uses GemRenderer in v1; side stones use legacy path.
3. **Material UI → gem params** — bridge uses production quality presets; live mapping from gemstone material settings not yet wired.
4. **Overlay compositing** — gem shader alpha channel must align with model-viewer pixels; verify on staging jewelry products.
5. **Lite GLB variant** — mobile AR-lite model path may differ from full model gem topology.
6. **Stress test** — queue/cache logic only; full browser memory profiling still manual.

---

*Generated for staging validation — do not deploy to production without acceptance testing.*
