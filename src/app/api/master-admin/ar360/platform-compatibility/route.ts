import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { listPlatformCompatibilityReport } from "@/lib/platform-versioning/platform-isolation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { searchParams } = new URL(req.url);
    const releaseIdRaw = searchParams.get("releaseId");
    const customerUid = searchParams.get("customerUid");
    const releaseId =
      releaseIdRaw != null && releaseIdRaw !== "" ? Number(releaseIdRaw) : null;

    const report = await listPlatformCompatibilityReport({
      releaseId: releaseId != null && Number.isInteger(releaseId) ? releaseId : null,
      customerUid: customerUid ? String(customerUid) : null,
      limit: 200,
    });

    await logAdminAudit(
      admin,
      "ar360.platform_compatibility.checked",
      "ar360_platform_compatibility",
      report.platformRelease ? String(report.platformRelease.id) : "none",
      {
        platformVersion: report.platformRelease?.version ?? null,
        productCount: report.rows.length,
        customerUid: customerUid || null,
        diagnosticOnly: true,
      },
    );

    return NextResponse.json({
      ...report,
      note: "Diagnostic only. Platform release changes never auto-migrate products.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/platform-compatibility GET]", error);
    return NextResponse.json({ error: "Unable to load compatibility report" }, { status: 500 });
  }
}
