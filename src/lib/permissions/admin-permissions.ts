// ─── Master Admin permission definitions ────────────────────────────────────

export type AdminPermission =
  | "customers.read"
  | "customers.update"
  | "customers.suspend"
  | "customers.delete"
  | "customers.impersonate"
  | "subscriptions.read"
  | "subscriptions.update"
  | "subscriptions.cancel"
  | "billing.read"
  | "billing.refund"
  | "billing.manual_payment"
  | "invoices.generate"
  | "products.read"
  | "products.update"
  | "products.delete"
  | "storage.read"
  | "storage.cleanup"
  | "coupons.read"
  | "coupons.manage"
  | "tickets.read"
  | "tickets.manage"
  | "analytics.read"
  | "admins.manage"
  | "settings.read"
  | "settings.manage"
  | "audit.read"
  | "enterprise_requests.read"
  | "enterprise_requests.manage"
  | "object_capture.read"
  | "object_capture.manage"
  | "object_capture.download"
  | "exports.download";

export type AdminRoleCode =
  | "super_admin"
  | "operations_admin"
  | "billing_admin"
  | "support_admin"
  | "content_admin"
  | "analytics_viewer"
  | "read_only";

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  "customers.read",
  "customers.update",
  "customers.suspend",
  "customers.delete",
  "customers.impersonate",
  "subscriptions.read",
  "subscriptions.update",
  "subscriptions.cancel",
  "billing.read",
  "billing.refund",
  "billing.manual_payment",
  "invoices.generate",
  "products.read",
  "products.update",
  "products.delete",
  "storage.read",
  "storage.cleanup",
  "coupons.read",
  "coupons.manage",
  "tickets.read",
  "tickets.manage",
  "analytics.read",
  "admins.manage",
  "settings.read",
  "settings.manage",
  "audit.read",
  "enterprise_requests.read",
  "enterprise_requests.manage",
  "object_capture.read",
  "object_capture.manage",
  "object_capture.download",
  "exports.download",
];

export const SUPER_ADMIN_ROLE: AdminRoleCode = "super_admin";

/** Static fallback matrix used when DB role rows are unavailable (dev bootstrap). */
export const ROLE_PERMISSION_FALLBACK: Record<AdminRoleCode, AdminPermission[]> = {
  super_admin: ALL_ADMIN_PERMISSIONS,
  operations_admin: [
    "customers.read",
    "customers.update",
    "customers.suspend",
    "subscriptions.read",
    "subscriptions.update",
    "products.read",
    "products.update",
    "products.delete",
    "storage.read",
    "storage.cleanup",
    "analytics.read",
    "exports.download",
    "audit.read",
    "enterprise_requests.read",
    "enterprise_requests.manage",
    "object_capture.read",
    "object_capture.manage",
    "object_capture.download",
  ],
  billing_admin: [
    "customers.read",
    "subscriptions.read",
    "subscriptions.update",
    "subscriptions.cancel",
    "billing.read",
    "billing.refund",
    "billing.manual_payment",
    "invoices.generate",
    "analytics.read",
    "exports.download",
    "enterprise_requests.read",
    "enterprise_requests.manage",
  ],
  support_admin: ["customers.read", "subscriptions.read", "tickets.read", "tickets.manage", "object_capture.read"],
  content_admin: ["products.read", "products.update", "products.delete", "storage.read", "analytics.read", "object_capture.read"],
  analytics_viewer: [
    "customers.read",
    "subscriptions.read",
    "billing.read",
    "products.read",
    "storage.read",
    "coupons.read",
    "tickets.read",
    "analytics.read",
    "audit.read",
    "exports.download",
    "object_capture.read",
  ],
  read_only: ALL_ADMIN_PERMISSIONS.filter(
    (code) => code.endsWith(".read") && code !== "enterprise_requests.read",
  ),
};

export function isAdminPermission(value: string): value is AdminPermission {
  return (ALL_ADMIN_PERMISSIONS as string[]).includes(value);
}

export function hasAdminPermission(
  roleCode: AdminRoleCode | null | undefined,
  permissions: ReadonlySet<string> | readonly string[],
  permission: AdminPermission,
): boolean {
  if (roleCode === SUPER_ADMIN_ROLE) return true;
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  return set.has(permission);
}

export function hasAnyAdminPermission(
  roleCode: AdminRoleCode | null | undefined,
  permissions: ReadonlySet<string> | readonly string[],
  required: AdminPermission | AdminPermission[],
): boolean {
  const list = Array.isArray(required) ? required : [required];
  return list.some((permission) => hasAdminPermission(roleCode, permissions, permission));
}

export function hasAllAdminPermissions(
  roleCode: AdminRoleCode | null | undefined,
  permissions: ReadonlySet<string> | readonly string[],
  required: AdminPermission[],
): boolean {
  return required.every((permission) => hasAdminPermission(roleCode, permissions, permission));
}
