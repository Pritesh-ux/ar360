# User Panel — Plan Enforcement (Stage 3)

## Canonical sources

| Concern | Canonical module |
|---------|------------------|
| Legacy plan ID mapping (`free` → `trial`, etc.) | `src/lib/billing/plan-enforcement.ts` → `mapLegacyPlanId()` |
| Plan limits (DB + fallback) | `src/lib/billing/resolve-plan-limits.ts` → `resolvePlanLimits()` |
| Active subscription gate | `src/lib/subscription/check-subscription.ts` |
| Action entitlement (upload/viewer/embed) | `src/lib/billing/entitlement.ts` → `getBillingEntitlement()` |
| Static plan catalog (UI labels) | `src/lib/billing/plans.ts` → `getPlanById()` (uses `mapLegacyPlanId`) |
| DB plan rows | `src/lib/billing/admin-plans.ts` → `getBillingPlans()` |

## Enforcement flow

```
API route
  → requireScopedApiUser()     // session customerUid, block suspended
  → checkSubscription()        // active / expired / suspended
  → getBillingEntitlement()    // limits + usage + action check
  → domain service + MySQL
```

## Customer scope

| Helper | Module |
|--------|--------|
| `getSessionCustomerUid()` | `customerIsolation.ts` |
| `verifyCustomerProductAccess()` | `customerIsolation.ts` (excludes soft-deleted products) |
| `requireScopedApiUser()` | `user-panel/api-guard.ts` |
| `getUserPanelSessionSummary()` | `user-panel/session-context.ts` |

Never trust client-provided `customerUid`, `planId`, or product owner IDs.

## Workspace

Default workspace is ensured server-side via `ensureDefaultWorkspace()` in `session-context.ts` (enterprise layer).

## Removed duplicates (Stage 3)

- `mapLegacyPlanId` removed from `admin-plans.ts` (single export from `plan-enforcement.ts`)
- `adminPlanToLimits` removed from `entitlement.ts` (uses `resolvePlanLimits()`)
