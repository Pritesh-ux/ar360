import { NextRequest, NextResponse } from "next/server";
import { mutateAdminCaptureJob } from "@/lib/master-admin/object-capture.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("object_capture.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason || "").trim();
  if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  try {
    const result = await mutateAdminCaptureJob(id, String(body.action || ""), {
      assignedAdminId: body.assignedAdminId == null || body.assignedAdminId === "" ? null : Number(body.assignedAdminId),
      priority: body.priority, reviewStatus: body.reviewStatus, reason, note: body.note,
    }, auth.admin.id);
    if (!result) return NextResponse.json({ error: "Capture job not found" }, { status: 404 });
    await writeMasterAdminAudit({
      adminId: auth.admin.id, action: `object_capture.${body.action}`, entityType: "object_capture_job", entityId: id,
      metadata: {
        before: result.before.job, after: result.after?.job || null, reason, jobId: id,
        customerId: result.before.job.customerUid, productId: result.after?.job.productId || result.before.job.productId,
      },
    });
    return NextResponse.json({ ok: true, ...result.after });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action failed" }, { status: 400 });
  }
}
