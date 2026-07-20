import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { listAdminRoles, listMasterAdmins, type AdminListFilters } from "@/lib/master-admin/admins.service";
import { paginationMeta } from "@/lib/master-admin/pagination";

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
