import { NextRequest, NextResponse } from "next/server";
import {
  changeEnterpriseCustomPlanAvailability,
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
  getReusableEnterpriseCustomPlans,
  updateEnterpriseCustomPlanForRequest,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

function hasPlanFieldUpdates(body: Record<string, unknown>) {
  return [
    "name",
    "billingCycle",
    "pricePaise",
    "storageLimitBytes",
    "bandwidthLimitBytes",
    "productLimit",
    "teamMemberLimit",
    "allowViewer",
    "allowUpload",
    "allowAr",
    "allowQr",
    "allowShare",
    "allowEmbed",
    "allowObjectCapture",
    "allowCustomDomain",
    "customBranding",
    "advancedAnalytics",
    "prioritySupport",
    "dedicatedInfrastructure",
    "slaSupport",
  ].some((key) => key in body);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id, planId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (!(await getEnterpriseSalesRequest(id))) {
      return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });
    }

    // Full feature / limits update (post-payment fix path)
    if (hasPlanFieldUpdates(body)) {
      await updateEnterpriseCustomPlanForRequest(
        id,
        planId,
        {
          name: typeof body.name === "string" ? body.name : "",
          billingCycle: body.billingCycle,
          pricePaise: Number(body.pricePaise),
          storageLimitBytes: body.storageLimitBytes == null ? null : Number(body.storageLimitBytes),
          bandwidthLimitBytes:
            body.bandwidthLimitBytes == null ? null : Number(body.bandwidthLimitBytes),
          productLimit: body.productLimit == null ? null : Number(body.productLimit),
          modelLimit: body.modelLimit == null ? null : Number(body.modelLimit),
          arExperienceLimit:
            body.arExperienceLimit == null ? null : Number(body.arExperienceLimit),
          teamMemberLimit: body.teamMemberLimit == null ? null : Number(body.teamMemberLimit),
          qrLimit: body.qrLimit == null ? null : Number(body.qrLimit),
          shareLinkLimit: body.shareLinkLimit == null ? null : Number(body.shareLinkLimit),
          customBranding: body.customBranding === true,
          allowViewer: body.allowViewer !== false,
          allowUpload: body.allowUpload !== false,
          allowAr: body.allowAr !== false,
          allowQr: body.allowQr !== false,
          allowShare: body.allowShare !== false,
          allowEmbed: body.allowEmbed !== false,
          allowObjectCapture: body.allowObjectCapture !== false,
          allowCustomDomain: body.allowCustomDomain === true,
          advancedAnalytics: body.advancedAnalytics === true,
          ocCapturesPerMonth:
            body.ocCapturesPerMonth == null ? null : Number(body.ocCapturesPerMonth),
          ocComputeSecondsPerMonth:
            body.ocComputeSecondsPerMonth == null
              ? null
              : Number(body.ocComputeSecondsPerMonth),
          ocConcurrentJobs: body.ocConcurrentJobs == null ? null : Number(body.ocConcurrentJobs),
          ocMaxRetries: body.ocMaxRetries == null ? null : Number(body.ocMaxRetries),
          prioritySupport: body.prioritySupport === true,
          dedicatedInfrastructure: body.dedicatedInfrastructure === true,
          slaSupport: body.slaSupport === true,
          supportLevel: typeof body.supportLevel === "string" ? body.supportLevel : null,
          notes: typeof body.notes === "string" ? body.notes : null,
        },
        Number(auth.admin.id),
      );
      await writeMasterAdminAudit({
        adminId: auth.admin.id,
        action: "enterprise_custom_plan.updated",
        entityType: "enterprise_custom_plan",
        entityId: planId,
        metadata: { requestUid: id },
      });
      return NextResponse.json({
        ok: true,
        customPlans: await getReusableEnterpriseCustomPlans(),
        request: await getEnterpriseSalesRequest(id),
      });
    }

    if (typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { error: "Provide plan fields to update, or isActive boolean" },
        { status: 400 },
      );
    }
    await changeEnterpriseCustomPlanAvailability(planId, body.isActive);
    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_custom_plan.availability_changed",
      entityType: "enterprise_custom_plan",
      entityId: planId,
      metadata: { requestUid: id, isActive: body.isActive },
    });
    return NextResponse.json({
      ok: true,
      customPlans: await getReusableEnterpriseCustomPlans(),
      request: await getEnterpriseSalesRequest(id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Custom plan update failed";
    return NextResponse.json(
      { error: message },
      { status: error instanceof EnterpriseSalesValidationError ? 400 : 500 },
    );
  }
}
