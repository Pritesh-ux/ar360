import { NextRequest, NextResponse } from "next/server";
import { getAdminCaptureJob } from "@/lib/master-admin/object-capture.service";
import { readPrivateAsset } from "@/lib/object-capture/production-service";
import { guardAdminPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; asset: string }> }) {
  const { id, asset } = await params;
  const required = asset === "model" || asset === "log"
    ? ["object_capture.read", "object_capture.download"] as const
    : ["object_capture.read"] as const;
  const auth = await guardAdminPermission([...required], { request, requireAll: true });
  if (auth instanceof NextResponse) return auth;
  const detail = await getAdminCaptureJob(id);
  if (!detail) return NextResponse.json({ error: "Capture job not found" }, { status: 404 });
  if (asset === "log") {
    await writeMasterAdminAudit({ adminId: auth.admin.id, action: "object_capture.log_download", entityType: "object_capture_job", entityId: id,
      metadata: { jobId: id, customerId: detail.job.customerUid, productId: detail.job.productId } });
    return new NextResponse(detail.job.processingLog || "", { headers: {
      "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${id}-processing.log"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    }});
  }
  let key = asset === "model" || asset === "preview-model"
    ? detail.job.modelKey
    : asset === "thumbnail" ? detail.job.thumbnailKey : null;
  let mediaType = asset === "model" || asset === "preview-model" ? "model/gltf-binary" : "image/jpeg";
  if (asset.startsWith("source-")) {
    const rows = await query<{ storage_key: string; media_type: string }>(
      "SELECT storage_key,media_type FROM object_capture_images WHERE job_id=? AND id=? LIMIT 1", [id, asset.slice(7)]);
    key = rows[0]?.storage_key || null; mediaType = rows[0]?.media_type || mediaType;
  }
  if (!key) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  try {
    const data = await readPrivateAsset(detail.job.customerUid, key);
    if (asset === "model") {
      await writeMasterAdminAudit({ adminId: auth.admin.id, action: "object_capture.model_download", entityType: "object_capture_job", entityId: id,
        metadata: { jobId: id, customerId: detail.job.customerUid, productId: detail.job.productId } });
    }
    return new NextResponse(data, { headers: {
      "Content-Type": mediaType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff",
      ...(asset === "model" ? { "Content-Disposition": `attachment; filename="${id}.glb"` } : {}),
    }});
  } catch {
    return NextResponse.json({ error: "Asset unavailable" }, { status: 404 });
  }
}
