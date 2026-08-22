import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { getCustomerOwnedRolloutPreview } from "@/lib/platform-versioning/customer-platform-update.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Read-only Phase 9 rollout preview for the owning customer only. */
export async function GET(_req: NextRequest, context: Ctx) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid rollout id" }, { status: 400 });
    }

    const preview = await getCustomerOwnedRolloutPreview({
      customerUid: user.customerUid,
      rolloutId: id,
    });
    if (!preview) {
      return NextResponse.json({ error: "Rollout not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...preview });
  } catch (error) {
    console.error("[account/platform/rollouts/:id GET]", error);
    return NextResponse.json({ error: "Unable to load rollout" }, { status: 500 });
  }
}
