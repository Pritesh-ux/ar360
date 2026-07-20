import { NextRequest, NextResponse } from "next/server";
import { getAdminCaptureJob } from "@/lib/master-admin/object-capture.service";
import { guardAdminPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("object_capture.read", { request });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const detail = await getAdminCaptureJob(id);
    if (!detail) return NextResponse.json({ error: "Capture job not found" }, { status: 404 });
    return NextResponse.json({
      ...detail,
      canManage: auth.roleCode === "super_admin" || auth.permissions.has("object_capture.manage"),
      canDownload: auth.roleCode === "super_admin" || auth.permissions.has("object_capture.download"),
      assignees: (await import("@/lib/master-admin/object-capture.service").then((m) => m.listAdminCaptureJobs({ pageSize: 1 }))).assignees,
    });
  } catch (error) {
    console.error("[master-admin/object-capture/detail]", error);
    return NextResponse.json({ error: "Unable to load capture job" }, { status: 500 });
  }
}
