import { query, ensureAdminSchema, type QueryValue } from "@/lib/db";
import { clearAdminPermissionCache } from "@/lib/permissions/admin-rbac";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { paginationMeta } from "@/lib/master-admin/pagination";

export type AdminListFilters = {
  search?: string;
  status?: string;
  roleId?: string;
  page?: number;
  pageSize?: number;
};

function buildAdminWhere(filters: AdminListFilters) {
  const clauses: string[] = ["1=1"];
  const values: QueryValue[] = [];

  const search = (filters.search || "").trim();
  if (search) {
    clauses.push("(ma.name LIKE ? OR ma.email LIKE ? OR ma.admin_uid LIKE ?)");
    const like = `%${search}%`;
    values.push(like, like, like);
  }

  if (filters.status && filters.status !== "all") {
    clauses.push("ma.status = ?");
    values.push(filters.status === "active" ? "Active" : "Disabled");
  }

  if (filters.roleId && filters.roleId !== "all") {
    clauses.push("ma.role_id = ?");
    values.push(Number(filters.roleId));
  }

  return { where: `WHERE ${clauses.join(" AND ")}`, values };
}

export async function listAdminRoles() {
  await ensureAdminSchema();
  const rows = await query<{ id: number; code: string; name: string; description: string }>(`
    SELECT id, code, name, description FROM admin_roles ORDER BY name ASC
  `).catch(() => []);
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
  }));
}

export async function listMasterAdmins(filters: AdminListFilters = {}) {
  await ensureAdminSchema();

  const page = Math.max(1, Number(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize || 15)));
  const offset = (page - 1) * pageSize;
  const { where, values } = buildAdminWhere(filters);

  const fromClause = `
    FROM master_admins ma
    LEFT JOIN admin_roles ar ON ar.id = ma.role_id
  `;

  const [countRows, rows, summaryRows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) AS total ${fromClause} ${where}`, values),
    query<{
      id: number;
      admin_uid: string | null;
      name: string;
      email: string;
      status: string;
      role_id: number | null;
      role_code: string | null;
      role_name: string | null;
      last_login_at: string | null;
      created_at: string;
    }>(`
      SELECT ma.id, ma.admin_uid, ma.name, ma.email, ma.status, ma.role_id,
        ar.code AS role_code, ar.name AS role_name,
        ma.last_login_at, ma.created_at
      ${fromClause}
      ${where}
      ORDER BY ma.created_at DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),

    query<any>(`
      SELECT
        COUNT(*) AS total,
        SUM(ma.status = 'Active') AS activeCount,
        SUM(ma.status = 'Disabled') AS disabledCount,
        SUM(ma.last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS recentLogins
      ${fromClause}
      ${where}
    `, values),
  ]);

  const summaryRow = summaryRows[0] || {};

  return {
    admins: rows.map((row) => ({
      id: row.id,
      adminUid: row.admin_uid,
      name: row.name,
      email: row.email,
      status: row.status as "Active" | "Disabled",
      roleId: row.role_id,
      roleCode: row.role_code,
      roleName: row.role_name || "Unassigned",
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
    })),
    pagination: paginationMeta(Number(countRows[0]?.total || 0), page, pageSize),
    summary: {
      total: Number(summaryRow.total || 0),
      active: Number(summaryRow.activeCount || 0),
      disabled: Number(summaryRow.disabledCount || 0),
      recentLogins: Number(summaryRow.recentLogins || 0),
    },
  };
}

export async function updateMasterAdmin(input: {
  adminId: number;
  actorAdminId: number;
  status?: "Active" | "Disabled";
  roleId?: number | null;
}) {
  await ensureAdminSchema();

  if (input.adminId === input.actorAdminId && input.status === "Disabled") {
    throw new Error("You cannot disable your own account.");
  }

  const existing = await query<{ id: number; status: string; role_id: number | null }>(
    "SELECT id, status, role_id FROM master_admins WHERE id = ? LIMIT 1",
    [input.adminId],
  );
  if (!existing[0]) throw new Error("Admin not found.");

  const updates: string[] = [];
  const values: QueryValue[] = [];

  if (input.status) {
    updates.push("status = ?");
    values.push(input.status);
  }

  if (input.roleId !== undefined) {
    if (input.roleId != null) {
      const roleRows = await query<{ id: number }>("SELECT id FROM admin_roles WHERE id = ? LIMIT 1", [input.roleId]);
      if (!roleRows[0]) throw new Error("Invalid role.");
    }
    updates.push("role_id = ?");
    values.push(input.roleId);
  }

  if (updates.length === 0) throw new Error("No changes provided.");

  values.push(input.adminId);
  await query(`UPDATE master_admins SET ${updates.join(", ")} WHERE id = ?`, values);
  clearAdminPermissionCache(input.adminId);

  await writeMasterAdminAudit({
    adminId: input.actorAdminId,
    action: "admin.update",
    entityType: "master_admin",
    entityId: String(input.adminId),
    metadata: {
      status: input.status,
      roleId: input.roleId,
      previousStatus: existing[0].status,
      previousRoleId: existing[0].role_id,
    },
  });

  return { ok: true };
}
