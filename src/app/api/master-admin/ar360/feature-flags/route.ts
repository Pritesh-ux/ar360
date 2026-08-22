import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import {
  createFeatureFlag,
  FeatureFlagError,
  listFeatureFlags,
} from "@/lib/platform-versioning/feature-flags.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const flags = await listFeatureFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("[master-admin/ar360/feature-flags GET]", error);
    return NextResponse.json({ error: "Unable to load feature flags" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const flag = await createFeatureFlag({
      key: body.key ?? body.flagKey,
      description: body.description,
    });

    await logAdminAudit(admin, "ar360.feature_flag.created", "ar360_feature_flag", String(flag.id), {
      key: flag.key,
      enabled: flag.enabled,
    });

    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    if (error instanceof FeatureFlagError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[master-admin/ar360/feature-flags POST]", error);
    return NextResponse.json({ error: "Unable to create feature flag" }, { status: 500 });
  }
}
