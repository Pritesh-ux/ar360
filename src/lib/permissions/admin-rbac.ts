import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentMasterAdmin, requireApiAdmin, requireAdmin, type MasterAdminUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  type AdminPermission,
  type AdminRoleCode,
  ALL_ADMIN_PERMISSIONS,
  hasAdminPermission,
  hasAllAdminPermissions,
  hasAnyAdminPermission,
  isAdminPermission,
  ROLE_PERMISSION_FALLBACK,
  SUPER_ADMIN_ROLE,
} from "./admin-permissions";

const ADMIN_SESSION_COOKIE = "ar360_master_admin_session";

function tokenFromRequest(request?: NextRequest | Request) {
  if (!request) return undefined;

  if ("cookies" in request && typeof (request as NextRequest).cookies?.get === "function") {
    const fromCookies = (request as NextRequest).cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (fromCookies) return fromCookies;
  }

  const raw = request.headers.get("cookie") || "";
  for (const segment of raw.split(";")) {
    const idx = segment.indexOf("=");
    if (idx < 0) continue;
    if (segment.slice(0, idx).trim() !== ADMIN_SESSION_COOKIE) continue;
    let val = segment.slice(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  }
  return undefined;
}

/**
 * Globally patch guard calls: always try to recover the session from the
 * Cookie header even when the caller forgot to pass `{ request }`.
 */
async function resolveAdminFromAnywhere(request?: NextRequest | Request) {
  const fromRequest = tokenFromRequest(request);
  return requireApiAdmin(fromRequest ? { token: fromRequest } : undefined);
}

export type AdminRbacContext = {
  admin: MasterAdminUser;
  roleCode: AdminRoleCode | null;
  permissions: Set<string>;
};

type AdminRoleRow = {
  roleCode: AdminRoleCode | null;
  permissionCode: string | null;
};

const permissionCache = new Map<number, { expiresAt: number; context: Omit<AdminRbacContext, "admin"> }>();
const CACHE_TTL_MS = 30_000;

function cacheKey(adminId: number) {
  return adminId;
}

function getCachedContext(adminId: number) {
  const hit = permissionCache.get(cacheKey(adminId));
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.context;
}

function setCachedContext(adminId: number, context: Omit<AdminRbacContext, "admin">) {
  permissionCache.set(cacheKey(adminId), { context, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearAdminPermissionCache(adminId?: number) {
  if (adminId == null) {
    permissionCache.clear();
    return;
  }
  permissionCache.delete(cacheKey(adminId));
}

function toAdminPermissionList(values: Iterable<string>): AdminPermission[] {
  return [...values].filter(isAdminPermission);
}

async function loadAdminRbac(adminId: number): Promise<Omit<AdminRbacContext, "admin">> {
  const cached = getCachedContext(adminId);
  if (cached) return cached;

  const rows = await query<AdminRoleRow>(
    `SELECT ar.code AS roleCode, arp.permission_code AS permissionCode
     FROM master_admins ma
     LEFT JOIN admin_roles ar ON ar.id = ma.role_id
     LEFT JOIN admin_role_permissions arp ON arp.role_id = ar.id
     WHERE ma.id = ?
     LIMIT 500`,
    [adminId],
  );

  const roleCode = rows[0]?.roleCode ?? null;
  const permissions = new Set<string>();

  if (roleCode === SUPER_ADMIN_ROLE) {
    for (const code of ALL_ADMIN_PERMISSIONS) permissions.add(code);
  } else if (roleCode) {
    for (const row of rows) {
      if (row.permissionCode) permissions.add(row.permissionCode);
    }
    if (permissions.size === 0 && ROLE_PERMISSION_FALLBACK[roleCode]) {
      for (const code of ROLE_PERMISSION_FALLBACK[roleCode]) permissions.add(code);
    }
  } else {
    for (const code of ALL_ADMIN_PERMISSIONS) permissions.add(code);
  }

  const context = { roleCode: roleCode ?? SUPER_ADMIN_ROLE, permissions };
  setCachedContext(adminId, context);
  return context;
}

export async function getAdminRbacContext(admin: MasterAdminUser): Promise<AdminRbacContext> {
  const rbac = await loadAdminRbac(admin.id);
  return { admin, ...rbac };
}

export async function adminHasPermission(adminId: number, permission: AdminPermission): Promise<boolean> {
  const rbac = await loadAdminRbac(adminId);
  return hasAdminPermission(rbac.roleCode, rbac.permissions, permission);
}

export async function adminHasAnyPermission(
  adminId: number,
  permissions: AdminPermission | AdminPermission[],
): Promise<boolean> {
  const rbac = await loadAdminRbac(adminId);
  return hasAnyAdminPermission(rbac.roleCode, rbac.permissions, permissions);
}

export async function enrichMasterAdmin(admin: MasterAdminUser): Promise<MasterAdminUser> {
  const rbac = await loadAdminRbac(admin.id);
  return {
    ...admin,
    roleCode: rbac.roleCode ?? undefined,
    permissions: toAdminPermissionList(rbac.permissions),
  };
}

export class AdminRbacError extends Error {
  constructor(
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AdminRbacError";
  }
}

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

type GuardOptions = { requireAll?: boolean; request?: NextRequest | Request };

export async function guardAdminPermission(
  permission: AdminPermission | AdminPermission[],
  options?: GuardOptions,
): Promise<{ admin: MasterAdminUser; roleCode: AdminRoleCode | null; permissions: Set<string> } | NextResponse> {
  const admin = await resolveAdminFromAnywhere(options?.request);
  if (!admin) return unauthorizedResponse();

  const rbac = await loadAdminRbac(admin.id);
  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = options?.requireAll
    ? hasAllAdminPermissions(rbac.roleCode, rbac.permissions, required)
    : hasAnyAdminPermission(rbac.roleCode, rbac.permissions, required);

  if (!allowed) return forbiddenResponse(`Missing permission: ${required.join(", ")}`);

  return {
    admin: {
      ...admin,
      roleCode: rbac.roleCode ?? undefined,
      permissions: toAdminPermissionList(rbac.permissions),
    },
    roleCode: rbac.roleCode,
    permissions: rbac.permissions,
  };
}

export async function requireAdminPermission(permission: AdminPermission | AdminPermission[]) {
  const admin = await requireAdmin();
  const rbac = await loadAdminRbac(admin.id);
  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = hasAnyAdminPermission(rbac.roleCode, rbac.permissions, required);
  if (!allowed) redirect("/master-admin?error=forbidden");
  return enrichMasterAdmin(admin);
}

export async function getCurrentMasterAdminWithPermissions(token?: string) {
  const admin = await getCurrentMasterAdmin(token ? { token } : undefined);
  if (!admin) return null;
  return enrichMasterAdmin(admin);
}

export async function requireApiAdminPermission(
  permission: AdminPermission | AdminPermission[],
  options?: GuardOptions,
): Promise<MasterAdminUser | null> {
  const result = await guardAdminPermission(permission, options);
  if (result instanceof NextResponse) return null;
  return result.admin;
}
