import { NextResponse } from "next/server";
import { stopCustomerImpersonation } from "@/lib/auth";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await guardAdminPermission("customers.impersonate");
  if (auth instanceof NextResponse) return auth;

  await stopCustomerImpersonation();
  return NextResponse.json({ ok: true, redirectUrl: "/master-admin/customers" });
}
