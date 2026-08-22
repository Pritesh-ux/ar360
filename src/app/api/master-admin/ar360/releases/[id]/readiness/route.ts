import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { runStableReadinessCheck } from "@/lib/platform-versioning/stable-governance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: Ctx) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    const readiness = await runStableReadinessCheck(id);
    return NextResponse.json(readiness);
  } catch (error) {
    console.error("[master-admin/ar360/releases/:id/readiness]", error);
    return NextResponse.json({ error: "Unable to run readiness check" }, { status: 500 });
  }
}
