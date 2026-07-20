# Master Admin Design System (Stage 4)

Shared UI primitives for the master admin panel. Import from `@/components/ui/admin`.

---

## Location

```
src/components/ui/admin/
  tokens.ts              # Shared Tailwind class tokens
  status-resolver.ts     # Canonical status → tone mapping
  AdminMetricCard.tsx    # KPI / stat cards
  StatusBadge.tsx        # Status & plan badges
  AdminButton.tsx        # Primary / secondary / ghost / danger
  AdminCard.tsx          # Generic panel card
  AdminTablePanel.tsx    # Table wrapper with border + shadow
  AdminFilterBar.tsx     # Filter row with optional Clear
  AdminInput.tsx         # Styled input + select
  AdminEmptyState.tsx    # No-results placeholder
  AdminLoadingState.tsx  # Loading spinner row
  AdminPagination.tsx    # Page number footer
  AdminIconButton.tsx    # Table row icon actions
  index.ts               # Barrel export
```

Legacy wrappers in `src/components/features/master-admin/` re-export or delegate to these components:

| Legacy | Canonical |
|--------|-----------|
| `AdminStatCard` | `AdminMetricCard` (default layout) |
| `AdminTable` | Uses `adminCardCompactClass` token |
| `PlanBadge` | `StatusBadge` with `domain="plan"` |
| `*StatusClass()` utils | `resolveStatusClass()` in status-resolver |

---

## Design tokens

| Token | Use |
|-------|-----|
| `adminCardClass` | Standard metric / content cards |
| `adminCardCompactClass` | Dense cards + AdminTable shell |
| `adminTablePanelClass` | Full-width data tables |
| `adminInputClass` | Filters, forms |
| `adminPrimaryButtonClass` | CTA buttons (green) |
| `adminSecondaryButtonClass` | Outline buttons |

Colors inherit from `.master-admin-shell` CSS variables (`--color-primary`, etc.).

---

## Components

### AdminMetricCard

Two layouts:

- **`default`** — title on top, large value (login logs, activity logs)
- **`compact`** — icon circle + value (customers, dashboard KPIs)

```tsx
<AdminMetricCard
  layout="compact"
  title="Active Customers"
  value={128}
  note="84% of total"
  iconComponent={UserCheck}
  iconClassName="bg-emerald-50 text-emerald-600"
  sparkline={[4, 7, 5, 9, 6]}
/>
```

### StatusBadge

```tsx
<StatusBadge label="Paid" domain="billing" value="Paid" />
<StatusBadge label="Active" tone="success" />
```

Domains: `customer`, `billing`, `subscription`, `payment`, `couponType`, `couponStatus`, `ticketStatus`, `ticketPriority`, `product`, `productCategory`, `plan`.

### AdminButton

Variants: `primary` | `secondary` | `ghost` | `danger`. Sizes: `sm` | `md`.

### AdminTablePanel + AdminFilterBar

Standard list page shell (see Customers page):

```tsx
<AdminTablePanel>
  <AdminFilterBar onClear={clearFilters}>...</AdminFilterBar>
  {/* toolbar + table */}
  <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
</AdminTablePanel>
```

---

## Pages migrated in Stage 4

| Page | Components adopted |
|------|-------------------|
| `/master-admin` (dashboard) | AdminMetricCard, AdminButton, AdminCard |
| `/master-admin/customers` | Full table shell + metrics + StatusBadge |

Other modules can adopt incrementally; domain utils already route through `status-resolver`.

---

## Next (Stage 6+)

- Wire permission-gated quick action mutations (not just navigation)
- Full `/master-admin/notifications` page (currently nav badge: Soon)
- Advanced search filters and recent searches

See [master-admin-shell-features.md](./master-admin-shell-features.md) for Stage 5 global search, bell, and quick actions.

---

*End of Stage 4 design system doc.*
