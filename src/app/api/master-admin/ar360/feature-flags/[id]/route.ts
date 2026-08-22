import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  FeatureFlagError,
  updateFeatureFlag,
} from "@/lib/platform-versioning/feature-flags.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Ctx) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid feature flag id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { flag, previous } = await updateFeatureFlag(id, {
      description: body.description,
      enabled: body.enabled,
    });

    await logAdminAudit(admin, "ar360.feature_flag.changed", "ar360_feature_flag", String(flag.id), {
      key: flag.key,
      before: { enabled: previous.enabled, description: previous.description },
      after: { enabled: flag.enabled, description: flag.description },
      viewerWired: false,
    });

    return NextResponse.json({ flag });
  } catch (error) {
    if (error instanceof FeatureFlagError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[master-admin/ar360/feature-flags/:id PATCH]", error);
    return NextResponse.json({ error: "Unable to update feature flag" }, { status: 500 });
  }
}
