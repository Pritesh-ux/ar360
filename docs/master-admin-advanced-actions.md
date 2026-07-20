# Master Admin — Advanced Actions (Stage 9)

Stage 9 wires production-level admin actions that were previously stubbed with alerts or disabled controls.

## Customer impersonation

| Item | Detail |
|------|--------|
| Permission | `customers.impersonate` |
| Start | `POST /api/master-admin/customers/[customerUid]/impersonate` |
| Stop | `POST /api/master-admin/impersonation/stop` |
| Session | Sets `ar360_customer_session` + `ar360_impersonation` metadata cookie |
| UI | Customers list/detail **Login As User**; dashboard **ImpersonationBanner** with exit control |
| Audit | `customer.impersonate` |

**Security:** Only active (non-suspended, non-deleted) customers can be impersonated. Master admin session cookie is preserved.

## Customer delete (soft)

| Item | Detail |
|------|--------|
| Permission | `customers.delete` |
| API | `DELETE /api/master-admin/customers/[customerUid]` |
| Behavior | Sets customer + user status to `Deleted`, cancels active subscriptions |
| UI | Confirm modal on customers list and customer detail |
| Audit | `customer.delete` |

## Product transfer owner

| Item | Detail |
|------|--------|
| Permission | `products.update` |
| API | `PATCH /api/master-admin/products/[id]` `{ action: "transfer_owner", customerUid }` |
| Storage | Moves product folder on disk when present; updates `products.customer_uid`; recalculates storage |
| UI | `TransferOwnerModal` on products page |
| Audit | `product.transfer_owner` |

## Product delete (admin)

| Item | Detail |
|------|--------|
| Permission | `products.delete` |
| API | `PATCH /api/master-admin/products/[id]` `{ action: "delete" }` |
| Behavior | Deletes DB row, product folder, recalculates customer storage |
| UI | Confirm modal on products list |
| Audit | `product.delete` |

## Invoice email

| Item | Detail |
|------|--------|
| Permission | `billing.read` |
| API | `POST /api/master-admin/billing/invoices/[invoiceUid]/send` |
| Email | Uses `sendEmail()` + invoice HTML from `getMasterInvoiceHtml()` |
| UI | Billing page mail action; `AdminActionMessage` feedback |
| Audit | `invoice.send_email` |

## Support ticket create (UI)

| Item | Detail |
|------|--------|
| Permission | `tickets.manage` |
| API | Existing `POST /api/master-admin/support-tickets` |
| UI | `CreateTicketModal` on support tickets page |

## Shared audit helper

`src/lib/master-admin/audit-log.ts` — `writeMasterAdminAudit()` used by Stage 9 routes.

## Validation

```bash
npx tsc --noEmit
```
