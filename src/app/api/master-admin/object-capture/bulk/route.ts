import { NextRequest, NextResponse } from "next/server";
import {
  mutateAdminCaptureJob,
  type CapturePriority,
} from "@/lib/master-admin/object-capture.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  const auth = await guardAdminPermission("object_capture.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ids: string[] = Array.isArray(body.ids)
    ? [...new Set<string>(body.ids.map((value: unknown) => String(value)))].slice(0, 100)
    : [];
  const reason = String(body.reason || "").trim();
  if (!ids.length || !reason) return NextResponse.json({ error: "Jobs and a reason are required" }, { status: 400 });
  const results = [];
  for (const id of ids) {
    try {
      const changed = await mutateAdminCaptureJob(id, String(body.action || ""), {
        reason, assignedAdminId: body.assignedAdminId == null || body.assignedAdminId === "" ? null : Number(body.assignedAdminId),
        priority: body.priority as CapturePriority | undefined,
      }, auth.admin.id);
      if (!changed) throw new Error("Not found");
      await writeMasterAdminAudit({
        adminId: auth.admin.id, action: `object_capture.bulk_${body.action}`, entityType: "object_capture_job", entityId: id,
        metadata: { before: changed.before.job, after: changed.after?.job, reason, jobId: id,
          customerId: changed.before.job.customerUid, productId: changed.after?.job.productId || changed.before.job.productId },
      });
      results.push({ id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, error: error instanceof Error ? error.message : "Failed" });
    }
  }
  return NextResponse.json({ results, succeeded: results.filter((item) => item.ok).length });
}
