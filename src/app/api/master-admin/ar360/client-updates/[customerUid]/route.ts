import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  approveClientTargetRelease,
  getClientUpdateState,
  isValidUpdatePolicy,
  setClientTargetRelease,
  setClientUpdatePolicy,
} from "@/lib/platform-versioning/client-update-policy.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ customerUid: string }> };

export async function GET(_req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { customerUid: raw } = await context.params;
    const customerUid = decodeURIComponent(raw || "").trim();
    if (!customerUid) {
      return NextResponse.json({ error: "customerUid is required" }, { status: 400 });
    }

    const detail = await getClientUpdateState(customerUid);
    if (!detail) return NextResponse.json({ error: "Client not found" }, { status: 404 });

    return NextResponse.json({
      ...detail,
      note: "Changing policy or target does not migrate products. Use Phase 7 Migrations.",
    });
  } catch (error) {
    console.error("[master-admin/ar360/client-updates/:customerUid GET]", error);
    return NextResponse.json({ error: "Unable to load client update state" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { customerUid: raw } = await context.params;
    const customerUid = decodeURIComponent(raw || "").trim();
    if (!customerUid) {
      return NextResponse.json({ error: "customerUid is required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    if (action === "set_policy") {
      const policy = body.policy;
      if (!isValidUpdatePolicy(policy)) {
        return NextResponse.json(
          { error: "Invalid policy. Use MANUAL, APPROVAL_REQUIRED, or AUTO." },
          { status: 400 },
        );
      }
      const result = await setClientUpdatePolicy({
        customerUid,
        policy,
        adminId: admin.id,
      });
      await logAdminAudit(
        admin,
        "ar360.client_update_policy.changed",
        "ar360_client_update_policy",
        customerUid,
        {
          customerUid,
          oldPolicy: result.oldPolicy,
          newPolicy: result.newPolicy,
          autoExecutable: false,
          note: policy === "AUTO" ? "AUTO — NOT ACTIVE IN PHASE 8" : null,
        },
      );
      return NextResponse.json({
        ok: true,
        client: result.client,
        warning:
          policy === "AUTO"
            ? "AUTO — NOT ACTIVE IN PHASE 8. No automatic migration will run."
            : "Policy updated. Products were not modified.",
      });
    }

    if (action === "set_target_release") {
      const targetReleaseId =
        body.targetReleaseId == null || body.targetReleaseId === ""
          ? null
          : Number(body.targetReleaseId);
      if (targetReleaseId != null && (!Number.isInteger(targetReleaseId) || targetReleaseId <= 0)) {
        return NextResponse.json({ error: "Invalid targetReleaseId" }, { status: 400 });
      }
      const result = await setClientTargetRelease({
        customerUid,
        targetReleaseId,
        adminId: admin.id,
      });
      await logAdminAudit(
        admin,
        "ar360.client_release.targeted",
        "ar360_client_update_policy",
        customerUid,
        {
          customerUid,
          oldTargetReleaseId: result.oldTargetReleaseId,
          newTargetReleaseId: result.newTargetReleaseId,
          targetVersion: result.client.targetReleaseVersion,
        },
      );
      return NextResponse.json({
        ok: true,
        client: result.client,
        warning: "Target release set. No products were migrated. Use Phase 7 Migrations to upgrade.",
      });
    }

    if (action === "approve") {
      const client = await approveClientTargetRelease({
        customerUid,
        adminId: admin.id,
      });
      await logAdminAudit(
        admin,
        "ar360.client_release.approval_granted",
        "ar360_client_update_policy",
        customerUid,
        {
          customerUid,
          targetReleaseId: client.targetReleaseId,
          targetVersion: client.targetReleaseVersion,
          approvedBy: admin.id,
        },
      );
      return NextResponse.json({
        ok: true,
        client,
        warning: "Approval recorded. Migration still requires an explicit Phase 7 plan.",
      });
    }

    return NextResponse.json(
      { error: "Unknown action. Use set_policy | set_target_release | approve" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update client policy";
    console.error("[master-admin/ar360/client-updates/:customerUid POST]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
