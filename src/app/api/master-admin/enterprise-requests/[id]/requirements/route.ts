import { NextRequest, NextResponse } from "next/server";
import {
  EnterpriseSalesValidationError,
  getEnterpriseSalesRequest,
  updateEnterpriseSalesRequestRequirements,
} from "@/lib/enterprise-sales";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" ? value : Number(value);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const existing = await getEnterpriseSalesRequest(id);
    if (!existing) return NextResponse.json({ error: "Enterprise request not found" }, { status: 404 });

    await updateEnterpriseSalesRequestRequirements(
      id,
      {
        expectedProducts: optionalNumber(body.expectedProducts),
        expectedStorageGb: optionalNumber(body.expectedStorageGb),
        expectedMonthlyBandwidthGb: optionalNumber(body.expectedMonthlyBandwidthGb),
        needsMoreStorage: body.needsMoreStorage === true,
        needsMoreBandwidth: body.needsMoreBandwidth === true,
        needsMoreProducts: body.needsMoreProducts === true,
        needsTeamMembers: body.needsTeamMembers === true,
        needsCustomBranding: body.needsCustomBranding === true,
        needsDedicatedInfrastructure: body.needsDedicatedInfrastructure === true,
        needsPrioritySupport: body.needsPrioritySupport === true,
        needsSla: body.needsSla === true,
        needsQr: body.needsQr === true,
        needsEmbed: body.needsEmbed === true,
        needsShare: body.needsShare === true,
        needsAr: body.needsAr === true,
        needsAnalytics: body.needsAnalytics === true,
        additionalRequirements:
          typeof body.additionalRequirements === "string" ? body.additionalRequirements : null,
      },
      auth.admin.id,
    );

    await writeMasterAdminAudit({
      adminId: auth.admin.id,
      action: "enterprise_request.requirements_updated",
      entityType: "enterprise_request",
      entityId: id,
      metadata: {
        expectedProducts: body.expectedProducts ?? null,
        expectedStorageGb: body.expectedStorageGb ?? null,
        expectedMonthlyBandwidthGb: body.expectedMonthlyBandwidthGb ?? null,
      },
    });

    return NextResponse.json({ ok: true, request: await getEnterpriseSalesRequest(id) });
  } catch (error) {
    if (error instanceof EnterpriseSalesValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update requirements" },
      { status: 400 },
    );
  }
}
