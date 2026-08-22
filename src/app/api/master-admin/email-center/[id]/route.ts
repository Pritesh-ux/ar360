import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { getEmailLogDetail } from "@/lib/master-admin/email-center.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const logId = Number(id);
  if (!Number.isFinite(logId) || logId <= 0) {
    return NextResponse.json({ error: "Invalid email log id." }, { status: 400 });
  }

  try {
    const log = await getEmailLogDetail(logId);
    return NextResponse.json({ log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load email detail";
    const status = message === "Email log not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
