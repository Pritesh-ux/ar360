import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listAdminRoles, listMasterAdmins, type AdminListFilters } from "@/lib/master-admin/admins.service";
import { paginationMeta } from "@/lib/master-admin/pagination";
import { ensureAdminSchema, query } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { randomBytes } from "crypto";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilters(searchParams: URLSearchParams): AdminListFilters {
  return {
    search: (searchParams.get("search") || "").trim(),
    status: (searchParams.get("status") || "all").trim(),
    roleId: (searchParams.get("roleId") || "all").trim(),
  };
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("admins.manage");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const filters = parseFilters(searchParams);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 15)));

  try {
    const [data, roles] = await Promise.all([
      listMasterAdmins({ ...filters, page, pageSize }),
      listAdminRoles(),
    ]);
    return NextResponse.json({ ...data, roles });
  } catch (error) {
    console.error("[master-admin/admins]", error);
    return NextResponse.json({
      admins: [],
      roles: [],
      pagination: paginationMeta(0, 1, pageSize),
      summary: { total: 0, active: 0, disabled: 0, recentLogins: 0 },
      error: "Unable to load admins",
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("admins.manage");
  if (auth instanceof NextResponse) return auth;

  await ensureAdminSchema();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const roleId = body.roleId != null ? Number(body.roleId) : null;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existing = await query<{ id: number }>(
    "SELECT id FROM master_admins WHERE email = ? LIMIT 1",
    [email],
  );
  if (existing[0]) {
    return NextResponse.json({ error: "An admin with this email already exists." }, { status: 409 });
  }

  const adminUid = `ADM-${randomBytes(12).toString("hex").toUpperCase()}`;

  await query(
    `INSERT INTO master_admins (admin_uid, name, email, password_hash, status, role_id)
     VALUES (?, ?, ?, ?, 'Active', ?)`,
    [adminUid, name, email, hashPassword(password), roleId],
  );

  const newAdmin = await query<{ id: number }>(
    "SELECT id FROM master_admins WHERE admin_uid = ? LIMIT 1",
    [adminUid],
  );

  await writeMasterAdminAudit({
    adminId: auth.admin.id,
    action: "admin.create",
    entityType: "master_admin",
    entityId: adminUid,
    metadata: { name, email, roleId },
  });

  return NextResponse.json({ ok: true, adminUid, id: newAdmin[0]?.id });
}
