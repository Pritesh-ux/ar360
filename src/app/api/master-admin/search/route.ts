import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema } from "@/lib/db";
import { searchMasterAdmin } from "@/lib/master-admin/global-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission([
    "customers.read",
    "products.read",
    "billing.read",
    "tickets.read",
  ]);
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();

  const q = req.nextUrl.searchParams.get("q") || "";
  const limit = Number(req.nextUrl.searchParams.get("limit") || 5);
  const data = await searchMasterAdmin(q, limit);

  return NextResponse.json(data);
}
