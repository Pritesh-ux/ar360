# AR360 User Panel — Production Audit

**Date:** 2026-07-12  
**Scope:** Customer-facing `/dashboard/*` panel, public viewer routes, supporting APIs and services  
**Reference:** Locked User Panel screenshots (black icon rail + white nav sidebar, lime green accent)  
**Status:** Stage 1 baseline — no implementation changes yet

---

## Executive Summary

The AR360 project has a **working foundation** for products, 3D editor, public viewer, QR codes, analytics, billing (Razorpay), enterprise workspaces, and object capture — but the **User Panel UI does not match the approved reference design** and several major modules are **missing, stubbed, or split across duplicate implementations**.

| Area | Current State | Target State |
|------|---------------|--------------|
| Sidebar layout | Single 96px floating black icon rail only | Black rail + white label sidebar + plan card + notifications |
| Share Center | Does not exist | Full page with table + preview panel |
| Support (user) | Does not exist (admin-only tickets) | User ticket CRUD + admin sync |
| Billing page | Redirects to Settings tab | Dedicated tabbed Billing page |
| Subscription page | Nested under billing routes | Standalone Subscription page |
| Notifications (user) | None | DB-backed popover with unread count |
| Settings | Monolithic client page, localStorage-heavy | Sectioned settings matching reference |
| Design tokens | Mixed cyan (`#00B2CA`) and lime (`#C9FF57`) | Single canonical `--ar-primary` green |
| Data source | Products/QR/settings often fall back to localStorage | MySQL authoritative everywhere |

**Baseline build (2026-07-12):**
- `npx tsc --noEmit` — **PASS**
- `npm run build` — **PASS**
- `npm run lint` — **FAIL** on vendored `public/vendor/draco/*` (not app source); app lint not isolated

---

## 1. Current User Panel Route Structure

All customer routes live under **`/dashboard`**. No `/user-panel` namespace.

| Route | File | Status |
|-------|------|--------|
| `/dashboard` | `src/app/dashboard/page.tsx` | Functional — API-driven overview |
| `/dashboard/products` | `src/app/dashboard/products/page.tsx` | Functional — hybrid localStorage + API |
| `/dashboard/products/new` | `src/app/dashboard/products/new/page.tsx` | Functional upload wizard |
| `/dashboard/products/[id]` | `src/app/dashboard/products/[id]/page.tsx` | Full 3D editor (works, complex) |
| `/dashboard/materials` | `src/app/dashboard/materials/page.tsx` | **STUB** — heading only |
| `/dashboard/variants` | `src/app/dashboard/variants/page.tsx` | **STUB** — heading only |
| `/dashboard/qr-center` | `src/app/dashboard/qr-center/page.tsx` | Partial — API + localStorage fallback |
| `/dashboard/analytics` | `src/app/dashboard/analytics/page.tsx` | Functional — **dark theme inconsistency** |
| `/dashboard/analytics/live` | `src/app/dashboard/analytics/live/page.tsx` | Orphan — no nav link |
| `/dashboard/team` | `src/app/dashboard/team/page.tsx` | Functional enterprise team |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | Functional but localStorage-heavy |
| `/dashboard/billing` | `src/app/dashboard/billing/page.tsx` | **Redirect** → settings |
| `/dashboard/billing/checkout` | `src/app/dashboard/billing/checkout/page.tsx` | Functional Razorpay |
| `/dashboard/billing/subscription` | `src/app/dashboard/billing/subscription/page.tsx` | Duplicate of settings billing |
| `/dashboard/billing/invoices` | `src/app/dashboard/billing/invoices/page.tsx` | Duplicate invoice list |
| `/dashboard/assets` | `src/app/dashboard/assets/page.tsx` | **Redirect** → products |
| `/dashboard/object-capture` | `src/app/dashboard/object-capture/page.tsx` | **Redirect** → products |

### Missing routes (required by reference screenshots)

| Route | Priority |
|-------|----------|
| `/dashboard/share-center` | P0 |
| `/dashboard/share-center/[shareId]` | P1 |
| `/dashboard/subscription` | P0 |
| `/dashboard/support` | P0 |
| `/dashboard/support/[ticketId]` | P0 |
| `/dashboard/object-capture` (real page) | P1 |
| `/dashboard/object-capture/[jobId]` | P1 |
| `/dashboard/billing/invoices/[invoiceId]` | P1 |
| `/dashboard/settings/*` sub-routes (optional) | P2 |

### Public routes (existing)

| Route | File | Notes |
|-------|------|-------|
| `/viewer/[id]` | `src/app/viewer/[id]/page.tsx` | Canonical public viewer |
| `/qr/[id]` | `src/app/qr/[id]/page.tsx` | Redirects to viewer |
| `/qr-ar/[id]` | `src/app/qr-ar/[id]/page.tsx` | AR deep link |
| `/ar/[id]` | `src/app/ar/[id]/page.tsx` | AR launcher |
| `/q/[publicId]` | `src/app/q/[publicId]/page.tsx` | Short QR route |
| `/embed/[publicId]` | — | **MISSING** dedicated embed route |

### Layout hierarchy

```
src/app/layout.tsx                          [Server] Root
└── src/app/dashboard/layout.tsx              [Server] requireUser() + impersonation
      ├── DashboardThemeProvider              [Client]
      ├── CustomerSessionSync                 [Client] → localStorage
      ├── ImpersonationBanner                 [Client]
      └── DashboardShell                      [Client]
            ├── AppSidebar                    [Client] — 96px icon rail ONLY
            └── {children}
```

**Editor exception:** `/dashboard/products/[id]` skips `DashboardShell`; `ProductDetailClient` mounts its own `AppSidebar`.

---

## 2. Current Layout and Sidebar

### What exists

- **`AppSidebar.tsx`** — Fixed floating black rail (96px), rounded corners, icon-only nav
- **`DashboardShell.tsx`** — Adds left padding `pl-[152px]` for content offset
- No white label expansion panel
- No plan/usage card in sidebar
- No notification bell in sidebar
- User avatar reads from **localStorage**, not server session

### Reference design gaps

| Requirement | Current | Gap |
|-------------|---------|-----|
| Black icon rail | ✅ Partial | Rail is floating card, not full-height locked rail |
| White nav labels | ❌ | Icons only (title tooltips) |
| AR360 Studio branding | ❌ | Only "AR" badge |
| Active state green card | ⚠️ | Green fill on icon, not rounded right-side card |
| Nav order | ❌ | Missing Object Capture, Share Center, Subscription, Billing, Support |
| Plan card bottom | ❌ | Not present |
| Notification + logout bottom | ⚠️ | Logout only; no notifications |
| Separator before billing group | ❌ | N/A |

### Nav mismatch

| Reference | Current AppSidebar |
|-----------|------------------|
| Dashboard | Overview (`/dashboard`) |
| Products | Products |
| Object Capture | — (redirect stub) |
| QR Center | QR |
| Share Center | — **missing** |
| Analytics | Analytics |
| Subscription | — **missing** |
| Billing | — **missing** (in settings) |
| Support | — **missing** |
| Settings | Settings |
| — | Materials (**stub**) |
| — | Tags/Variants (**stub**) |
| — | Team (enterprise) |

---

## 3. Authentication Flow

| Component | Path | Notes |
|-----------|------|-------|
| Route guard | `src/proxy.ts` | Protects `/dashboard/*`, login/signup |
| Session | `src/lib/auth.ts` | HMAC cookie `ar360_customer_session` |
| Server guard | `requireUser()` in dashboard layout | All dashboard pages |
| API guard | `requireApiUser()` | Product/billing/analytics APIs |
| Login | `src/app/auth/actions.ts` | Rate-limited server actions |
| 2FA | `src/app/verify-2fa/page.tsx` | Supported |
| Logout | `src/app/logout/clear/route.ts` (canonical) + legacy `/logout` page | Duplicate logout paths |
| Impersonation | Master admin → customer session | Banner in layout |

**Issues:**
- `CustomerSessionSync` writes user to localStorage with hardcoded `plan: "Starter"`
- `AppSidebar` reads user from localStorage instead of server props
- No workspace context passed from layout to shell

---

## 4. Customer / Workspace Schema

### Primary isolation: `customerUid`

| Table | Key fields |
|-------|------------|
| `users` | `id`, `user_uid`, `email`, `password_hash`, `status`, 2FA |
| `customers` | `customer_uid`, `user_id`, `company_name`, `plan_id`, `status`, `storage_used_mb`, `bandwidth_used_mb` |
| `customer_subscriptions` | `customer_uid`, `plan_id`, `status`, period dates, Razorpay IDs |

### Enterprise layer (partial)

| Table | Purpose |
|-------|---------|
| `workspaces` | Multi-user companies |
| `workspace_members` | Roles within workspace |
| `workspace_api_keys`, `workspace_webhooks`, etc. | Enterprise features |

**Gap:** User panel primarily scopes by `customer_uid`, not `workspace_id`. Enterprise tables exist but are not the primary dashboard scope. Need canonical workspace resolution: `customer_uid` → default workspace.

**Missing tables:**
- `user_preferences` — settings stored in localStorage today
- `customer_notifications` — no user notification table
- `share_links` / `share_events` — sharing tracked only via analytics events
- `qr_scan_events` — scans counted on `product_qr_codes.scans` only

---

## 5. Product Upload Flow

| Step | Implementation | Status |
|------|----------------|--------|
| Auth + subscription | `checkSubscription()` on pages | ✅ |
| Plan limits | `checkUploadEntitlement()` in save-assets API | ✅ |
| Upload UI | `NewProductClient.tsx`, `UploadProductModal.tsx` | ✅ |
| Storage | `product-save.service.ts` + disk + MySQL | ✅ |
| Processing | Product status fields in MySQL | ⚠️ Partial |

**Issues:**
- `ProductsClient` saves duplicates to localStorage without API
- Folder management writes localStorage directly
- Delete may not always sync to API

---

## 6. Product Editor Flow

| Component | Path |
|-----------|------|
| Editor page | `ProductDetailClient.tsx` (~1900 lines) |
| Save | `/api/products/save-assets`, `/api/products/[id]` |
| Materials/variants | Stored in `products.settings`, `products.variants` JSON |

**Status:** Functional and feature-rich. Persistence via MySQL + disk.

**Issues:**
- localStorage fallback on load
- Mixed Hindi/English toast messages
- Editor re-mounts sidebar (3 panel layers)

---

## 7. Viewer / AR Flow

| Component | Path |
|-----------|------|
| Public viewer | `PublicViewerPage.tsx` |
| Route | `/viewer/[id]` |
| AR | `src/lib/ar-experience.ts` |
| Analytics | `track-event.ts` → `/api/analytics/event` |
| Entitlement | `checkViewerEntitlement()` on asset routes |

**Status:** Working. Share is client-side only (navigator.share, copy link).

**Gaps vs reference:**
- Branding toggle by plan not fully wired
- Camera framing improvements may be needed
- No dedicated mobile landing page flow (QR → landing → 3D → AR)
- `/embed/[publicId]` route missing

---

## 8. QR Implementation

| Layer | Path |
|-------|------|
| DB table | `product_qr_codes` |
| API | `/api/qr-codes/route.ts` |
| UI | `QrCenterClient.tsx` |
| PNG generation | `localCustomerStorage.saveQrPng()` |
| Public route | `/qr/[id]` → `/viewer/[id]?source=qr` |

**Status:** Partial. One QR per product (UNIQUE on `product_id`). No multi-QR names, expiry tabs, or right-side preview panel per reference.

**Gaps:**
- No `qr_scan_events` table
- No Share Center integration
- localStorage fallback for product list
- Missing: Active/Expired/Archived tabs, bulk actions, design customization persistence

---

## 9. Share / Embed Implementation

**No dedicated share system exists.**

Current sharing:
- `PublicViewerPage.tsx` — native share, copy link
- `analytics_events` — `share_native`, `copy_link` events
- `products.settings` JSON — optional share password/expiry

**Required (missing):**
- `share_links` table
- `/dashboard/share-center` page
- Create/edit/archive share links API
- Embed code generation
- Expiry and password protection server enforcement
- Share analytics aggregation

---

## 10. Analytics Implementation

| Layer | Path |
|-------|------|
| Ingestion | `server/analytics/analytics.service.ts` |
| Storage | `analytics_events`, `analytics_sessions`, `analytics_daily` |
| Dashboard API | `/api/analytics/dashboard` |
| User UI | `AnalyticsClient.tsx`, `DashboardOverviewClient.tsx` |

**Status:** Real MySQL aggregation exists.

**Issues:**
- Dark theme on Analytics page vs light portal elsewhere
- `/analytics/live` orphaned
- Dashboard and Analytics duplicate KPI surfaces
- No user-level export UI on analytics page (API exists)

---

## 11. Subscription Definitions

| Source | Path | Issue |
|--------|------|-------|
| DB plans | `billing_plans` table | Canonical when seeded |
| Static catalog | `lib/billing/plans.ts` | Fallback |
| Default limits | `lib/billing/plan-enforcement.ts` | Third source |
| Admin plans | `lib/billing/admin-plans.ts` | Duplicate `mapLegacyPlanId` |

**Enforcement chain:**
1. `check-subscription.ts` — active/inactive gate
2. `entitlement.ts` — action-specific limits
3. `resolve-plan-limits.ts` — DB → static fallback

**Gap:** Three sources of truth for plan limits. `customers.plan_id` defaults to `'free'` but seeds use `'professional'`.

---

## 12. Billing Implementation

| Feature | Status |
|---------|--------|
| Razorpay checkout | ✅ `/api/billing/checkout` |
| Webhook | ✅ `/api/billing/webhook/razorpay` |
| Invoices | ✅ `billing_invoices` + PDF |
| Invoice download | ✅ `/api/billing/invoices/[id]/download` |
| Billing profile/GST | ✅ `billing_profiles` |
| User UI | ⚠️ Split across Settings + 3 billing routes |

**Gaps vs reference Billing page:**
- No tabbed Overview/Invoices/Payment Methods/Billing Details page
- Payment methods — provider refs only, no dedicated UI section
- Usage summary cards not on dedicated billing page
- `Download Invoice` header action not on unified page

---

## 13. Object Capture Implementation

| Layer | Path |
|-------|------|
| API routes | `src/app/api/object-capture/*` (10 routes) |
| Service | `lib/object-capture/object-capture.service.ts` |
| Mock store | `lib/object-capture/mock-store.ts` — **in-memory, placeholder GLB** |
| UI | `ObjectCaptureClient.tsx` — **dead code** (page redirects) |

**Status:** Backend exists; user-facing page redirects to products. Mock pipeline auto-completes with placeholder model.

---

## 14. Notifications (User)

**Does not exist for customers.**

Admin notifications exist:
- `admin_notifications` table
- `lib/master-admin/notifications.ts`
- Master Admin bell panel (recently fixed z-index + real data)

**Required:**
- `customer_notifications` table (or scoped `notifications` with `recipient_type`)
- Sidebar bell with unread count
- Events: processing, billing, support reply, storage threshold, etc.

---

## 15. Support System

| Layer | Status |
|-------|--------|
| DB | `support_tickets`, `support_ticket_messages` |
| Admin | Full CRUD in master-admin |
| User API | **MISSING** |
| User UI | **MISSING** |
| Public contact | `/api/contact` — email only, not ticketing |

Users cannot create or view tickets. Admin replies are not surfaced to users.

---

## 16. Settings Pages

Single monolithic **`settings/page.tsx`** (~760 lines, client-only):
- Tabs: Account, Company, Billing, Invoices (internal sidebar)
- Saves to localStorage key `xr_settings_clean_v1_{uid}`
- Password update — **no API call**
- Help button — **decorative**
- Bell icon — **decorative**
- Double sidebar (AppSidebar + 300px settings nav)

**Missing sections from reference:**
- Security (sessions, 2FA UI)
- Notifications preferences (DB)
- Preferences (theme, grid/list, date format)
- Storage breakdown page
- Team Members (exists at `/dashboard/team` separately)
- API Access
- Danger Zone (account deletion)

---

## 17. Hardcoded / Mock Data Locations

| File | Issue |
|------|-------|
| `settings/page.tsx` | `fallbackPlans`, `defaultData`, `360-XR` branding |
| `CustomerSessionSync.tsx` | Hardcoded `plan: "Starter"` |
| `ProductsClient.tsx` | localStorage as primary/fallback |
| `QrCenterClient.tsx` | `DEFAULT_QR`, localStorage product list |
| `billing/checkout/page.tsx` | Cyan branding, `ARStudio360` |
| `object-capture/mock-store.ts` | Placeholder GLB, in-memory jobs |
| `object-capture/image-analysis.ts` | Mock blur/brightness |
| `clientProducts.ts` | Dev localStorage cache |
| `universal-viewer.ts` | localStorage analytics cache |

---

## 18. Duplicate Files / Services / Routes

| Area | Duplicates |
|------|------------|
| Plan mapping | `mapLegacyPlanId` in 2 files |
| Plan limits | `adminPlanToLimits` in 2 files |
| Plan catalogs | DB + static + DEFAULT_PLAN_LIMITS |
| Billing UI | Settings tabs + 3 `/dashboard/billing/*` pages |
| Invoice list | Settings + `/billing/invoices` |
| Logout | `/logout` page + `/logout/clear` route |
| Storage | `storage.ts` + `localCustomerStorage.ts` + adapters |
| Product sync | API route + disk-sync + product-save.service |
| Sidebar | AppSidebar + settings internal nav + editor panels |
| Analytics KPIs | Dashboard overview + Analytics page |

---

## 19. Broken Actions and Placeholder Buttons

| Location | Control | Issue |
|----------|---------|-------|
| `settings/page.tsx:457` | "Need help?" | No handler |
| `settings/page.tsx:457` | Bell icon | No notifications |
| `settings/page.tsx:319` | Update password | Local only, no API |
| `materials/page.tsx` | Entire page | Stub |
| `variants/page.tsx` | Entire page | Stub |
| `ProductsClient.tsx:515` | Duplicate product | localStorage only |
| `ProductsClient.tsx:286` | saveProducts | No API persist |
| Share Center | All actions | Page missing |
| Support | Create ticket | Page missing |
| Object Capture UI | All actions | Page redirects |

---

## 20. Database Schema Gaps

### Tables to add

| Table | Purpose |
|-------|---------|
| `customer_notifications` | User notification feed |
| `user_preferences` | Theme, grid/list, date format, email prefs |
| `share_links` | Share Center |
| `share_events` | Share analytics detail |
| `qr_scan_events` | QR scan tracking with dedup |
| `payment_methods` | Display metadata (provider refs) |
| `user_sessions` | Active session management (optional) |

### Columns to add (existing tables)

| Table | Columns |
|-------|---------|
| `products` | `folder`, `tags` JSON, `category`, `archived_at`, `processing_error` |
| `product_qr_codes` | `name`, `status`, `expires_at`, `style_json`, remove UNIQUE on product_id for multi-QR |
| `customers` | Align `plan_id` default with billing_plans IDs |

### Migration convention

- Path: `database/migrations/NN_*.sql`
- Runner: `scripts/db-migrate.ts` → `npm run db:migrate`
- Runtime DDL in `src/lib/db.ts` — disable in production via `SKIP_RUNTIME_DDL=true`

---

## 21. Missing Foreign Keys and Indexes

**Foreign keys:** Only RBAC join tables have FKs. All customer/product/billing relationships are logical only.

**Recommended indexes (new migration):**
- `customer_notifications (customer_uid, is_read, created_at)`
- `share_links (customer_uid, status, created_at)`
- `share_links (public_id)` UNIQUE
- `qr_scan_events (qr_code_id, scanned_at)`
- `products (customer_uid, status, deleted_at)`
- `products (customer_uid, folder, category)`
- `user_preferences (user_id)` UNIQUE

**Data consistency fixes:**
- Normalize `customer_uid` VARCHAR widths (40 vs 64 vs 80)
- Fix `customers.plan_id` default `'free'` → `'trial'`

---

## 22. Build Errors

| Check | Result |
|-------|--------|
| TypeScript | ✅ Pass |
| Production build | ✅ Pass |
| ESLint | ❌ Fails on vendored Draco JS in `public/vendor/` |
| Unit tests | ⚠️ Only 2 master-admin tests (`npm run test`) |
| User panel smoke | `smoke:e2e`, `smoke:product` exist but not run in this audit |

---

## 23. Hydration Issues

| Risk | Location |
|------|----------|
| localStorage read on mount | `AppSidebar`, `ProductsClient`, `settings/page.tsx` |
| Date formatting SSR/client | Various dashboard pages |
| Theme from localStorage | `DashboardThemeProvider` |

**Mitigation plan:** Pass server session data as props; use `useEffect` only for non-critical UI prefs; suppress hydration mismatch on dates with consistent locale.

---

## 24. Security Problems

| Issue | Severity | Notes |
|-------|----------|-------|
| localStorage as data fallback | High | Stale/wrong ownership data |
| Settings saves plan to localStorage | Medium | Client can fake plan display |
| No user support API | Medium | Users can't ticket but table exists |
| No share link server enforcement | High | Share settings in JSON only |
| Missing IDOR tests for user routes | Medium | `customerIsolation.ts` exists but coverage unknown |
| No CSRF tokens on mutations | Low-Medium | Cookie session + SameSite assumed |
| Draco vendor in lint scope | Low | Config issue |

**Existing strengths:**
- HMAC session cookies
- `requireUser()` / `requireApiUser()`
- `verifyCustomerProductAccess()`
- Parameterized SQL via `query()`
- Rate limiting on auth
- Razorpay webhook handling

---

## 25. Performance Bottlenecks

| Issue | Impact |
|-------|--------|
| `ProductDetailClient.tsx` size (~1900 lines) | Large client bundle on editor route |
| Products list localStorage + API double fetch | Unnecessary client work |
| Analytics raw event scans if aggregates missing | Slow dashboard |
| Double `syncAdminNotifications` pattern (admin) | Minor; note for user notifications |
| No Suspense boundaries on dashboard pages | Slower perceived load |
| 3D viewer imports | Should stay route-isolated (currently OK) |

---

## 26. UI Inconsistencies

| Issue | Files |
|-------|-------|
| Cyan vs lime green accent | `globals.css`, checkout, analytics |
| Dark analytics page | `AnalyticsClient.tsx` |
| Brand names: 360-XR, ARStudio360, AR360 Studio | settings, checkout, sidebar |
| Settings double sidebar | `settings/page.tsx` |
| Floating sidebar vs full-height locked rail | `AppSidebar.tsx` |
| Missing plan card / usage in sidebar | All dashboard pages |
| Master Admin design system separate from user panel | admin vs portal tokens |

**Existing token infrastructure:**
- `html[data-portal-theme="lime"]` in `globals.css` maps to `--color-primary` (lime)
- `--portal-accent` defaults to cyan in some contexts — must unify to `--ar-primary`

---

## 27. Proposed Canonical Architecture

```
src/
├── app/dashboard/                    # User panel routes (keep /dashboard)
├── components/user-panel/            # NEW canonical design system
│   ├── UserPanelShell.tsx            # Black rail + white nav + plan card
│   ├── UserSidebar.tsx
│   ├── UserMobileNav.tsx
│   ├── UserPageHeader.tsx
│   ├── UserMetricCard.tsx
│   ├── UserDataTable.tsx
│   ├── ProductCard.tsx
│   ├── NotificationPopover.tsx
│   └── ...
├── lib/user-panel/                   # User-specific services
│   ├── dashboard.service.ts
│   ├── notifications.service.ts
│   ├── share-links.service.ts
│   ├── support-tickets.service.ts    # User-scoped (wraps shared ticket repo)
│   └── preferences.service.ts
├── lib/billing/                      # KEEP — consolidate to single plan source
│   ├── entitlement.ts                # Single enforcement entry
│   └── resolve-plan-limits.ts        # Single limit resolver
├── lib/customerIsolation.ts          # KEEP — extend for workspace
└── server/                           # KEEP existing analytics, billing repos
```

**Principles:**
1. One sidebar component (`UserSidebar`) replaces `AppSidebar`
2. One plan limit resolver (remove duplicates)
3. MySQL authoritative; localStorage UI prefs only
4. User services scoped by `customer_uid` + workspace
5. Share/QR/Support get dedicated services + APIs
6. Reuse `ProductDetailClient` editor — do not rewrite

---

## 28. Exact Files to Modify (Stage-by-Stage)

### Stage 1 (this document)
- `docs/user-panel-production-audit.md` ✅

### Stage 2 — Database
- `database/migrations/16_user_panel_schema.sql` (new)
- `src/lib/db.ts` — add ensure functions
- `scripts/db-seed.ts` — user prefs seed

### Stage 3 — Auth / scoping
- `src/app/dashboard/layout.tsx` — pass session + subscription to shell
- `src/lib/customerIsolation.ts` — workspace scope
- `src/lib/billing/entitlement.ts` — consolidate
- `src/lib/billing/admin-plans.ts` — remove duplicate mapLegacyPlanId

### Stage 4 — Design system + sidebar
- `src/components/user-panel/UserPanelShell.tsx` (new)
- `src/components/user-panel/UserSidebar.tsx` (new)
- `src/components/features/dashboard/DashboardShell.tsx` — delegate to UserPanelShell
- `src/components/features/dashboard/AppSidebar.tsx` — deprecate
- `src/app/globals.css` — canonical `--ar-*` tokens

### Stage 5 — Dashboard
- `src/app/dashboard/DashboardOverviewClient.tsx`
- `src/app/api/dashboard/overview/route.ts`
- `src/lib/user-panel/dashboard.service.ts` (new)

### Stage 6 — Products
- `src/app/dashboard/products/ProductsClient.tsx` — remove localStorage authority
- `src/app/api/products/route.ts` — server pagination/filters

### Stage 7 — Editor
- `ProductDetailClient.tsx` — persistence audit only

### Stage 8 — Viewer
- `PublicViewerPage.tsx`
- `src/app/embed/[publicId]/page.tsx` (new)

### Stage 9 — QR Center
- `QrCenterClient.tsx` — full redesign
- `src/app/api/qr-codes/route.ts` — multi-QR, expiry, status

### Stage 10 — Share Center
- `src/app/dashboard/share-center/` (new)
- `src/lib/user-panel/share-links.service.ts` (new)
- `src/app/api/share-links/` (new)

### Stage 11 — Analytics
- `AnalyticsClient.tsx` — light theme, unified with dashboard

### Stage 12 — Subscription
- `src/app/dashboard/subscription/page.tsx` (new)

### Stage 13 — Billing
- `src/app/dashboard/billing/page.tsx` — real tabbed page
- Consolidate/remove duplicate billing routes

### Stage 14 — Support + Notifications
- `src/app/dashboard/support/` (new)
- `src/lib/user-panel/notifications.service.ts` (new)
- `src/app/api/customer/notifications/` (new)
- `src/app/api/customer/support/` (new)

### Stage 15 — Settings
- Split `settings/page.tsx` into section pages or tabs
- `src/lib/user-panel/preferences.service.ts`

### Stage 16 — Object Capture
- Restore `object-capture/page.tsx`
- Remove mock-store or gate behind dev flag

### Stage 17 — QA
- `docs/user-panel-*.md` (remaining docs)
- `scripts/e2e-customer-smoke.mjs` — expand
- Unit tests for user services

---

## 29. Migration List (Proposed)

| # | File | Contents |
|---|------|----------|
| 16 | `16_user_panel_schema.sql` | `customer_notifications`, `user_preferences`, `share_links`, `share_events`, `qr_scan_events`; alter `product_qr_codes`; product folder/tags indexes |
| 17 | `17_user_panel_fk_indexes.sql` | Performance indexes (no FK enforcement yet — safe additive) |
| 18 | `18_payment_methods.sql` | Optional payment method display table |

All migrations: idempotent `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` where supported.

---

## 30. Risks — Must Not Break

| Risk | Mitigation |
|------|------------|
| Product editor save/load | Change UI only; do not alter save-assets contract without tests |
| Public viewer `/viewer/[id]` | Keep route; additive embed route |
| Razorpay checkout + webhook | Do not modify payment flow during UI work |
| Master Admin panel | Separate namespace; no shared component breaks |
| Existing product JSON on disk | disk-sync must keep working |
| Impersonation flow | Preserve banner + session in layout |
| QR redirect `/qr/[id]` | Keep backward compatible URLs |
| Enterprise team at `/dashboard/team` | Merge into Settings or keep linked |
| Object capture API routes | Do not delete; replace mock with real queue incrementally |
| Auth cookies / 2FA | No session format changes without migration |

---

## Commands Run (Stage 1 Baseline)

```bash
npx tsc --noEmit          # PASS
npm run build             # PASS
npm run lint              # FAIL (vendor draco only)
npm run test              # Not run — 2 unit tests exist
npm run smoke:e2e         # Not run — reserved for Stage 17
npm run db:status         # Not run — requires MySQL connection
```

---

## Next Step

**Stage 2:** Database migration foundation — add missing tables/columns/indexes without breaking existing data. Then Stage 3 auth/workspace consolidation, then Stage 4 locked sidebar implementation.

See also (to be created in later stages):
- `docs/user-panel-architecture.md`
- `docs/user-panel-feature-status.md`
