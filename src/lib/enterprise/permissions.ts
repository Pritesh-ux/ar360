// ─── Role definitions ─────────────────────────────────────────────────────────

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer" | "billing";

export type Permission =
  | "products.read"
  | "products.create"
  | "products.update"
  | "products.delete"
  | "products.publish"
  | "assets.read"
  | "assets.upload"
  | "analytics.read"
  | "team.manage"
  | "billing.manage"
  | "api.manage"
  | "branding.manage"
  | "settings.manage"
  | "versions.read"
  | "versions.restore"
  | "webhooks.manage"
  | "domains.manage"
  | "audit.read";

export type ApiScope =
  | "products.read"
  | "products.write"
  | "viewer.read"
  | "analytics.read"
  | "assets.write";

// ─── Role → Permission matrix ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  owner: [
    "products.read", "products.create", "products.update", "products.delete", "products.publish",
    "assets.read", "assets.upload",
    "analytics.read",
    "team.manage",
    "billing.manage",
    "api.manage",
    "branding.manage",
    "settings.manage",
    "versions.read", "versions.restore",
    "webhooks.manage",
    "domains.manage",
    "audit.read",
  ],
  admin: [
    "products.read", "products.create", "products.update", "products.delete", "products.publish",
    "assets.read", "assets.upload",
    "analytics.read",
    "team.manage",
    "api.manage",
    "branding.manage",
    "settings.manage",
    "versions.read", "versions.restore",
    "webhooks.manage",
    "domains.manage",
    "audit.read",
  ],
  editor: [
    "products.read", "products.create", "products.update", "products.publish",
    "assets.read", "assets.upload",
    "analytics.read",
    "versions.read",
  ],
  viewer: [
    "products.read",
    "assets.read",
    "analytics.read",
    "versions.read",
  ],
  billing: [
    "billing.manage",
    "analytics.read",
    "audit.read",
  ],
};

export function hasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: WorkspaceRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export const ALL_ROLES: WorkspaceRole[] = ["owner", "admin", "editor", "viewer", "billing"];
export const ASSIGNABLE_ROLES: WorkspaceRole[] = ["admin", "editor", "viewer", "billing"];
