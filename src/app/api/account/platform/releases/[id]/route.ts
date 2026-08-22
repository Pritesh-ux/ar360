import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import {
  getCustomerOwnedRolloutPreview,
  getCustomerReleaseDetail,
  markPlatformReleaseViewed,
  markProductUpdateReviewed,
} from "@/lib/platform-versioning/customer-platform-update.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: Ctx) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    const detail = await getCustomerReleaseDetail({
      customerUid: user.customerUid,
      releaseId: id,
    });
    if (!detail) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...detail });
  } catch (error) {
    console.error("[account/platform/releases/:id GET]", error);
    return NextResponse.json({ error: "Unable to load release" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Ctx) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "view").trim();

    if (action === "view") {
      const state = await markPlatformReleaseViewed({
        customerUid: user.customerUid,
        releaseId: id,
      });
      await writeCustomerActivity({
        customerUid: user.customerUid,
        userId: user.id,
        eventType: "ar360.platform_release.viewed",
        title: "Platform release viewed",
        detail: `Release #${id}`,
        meta: { releaseId: id, informational: true, migratesProducts: false },
      }).catch(() => undefined);
      return NextResponse.json({ success: true, viewState: state });
    }

    if (action === "review_product_update") {
      const rolloutId = body.rolloutId != null ? Number(body.rolloutId) : null;
      if (rolloutId != null) {
        const owned = await getCustomerOwnedRolloutPreview({
          customerUid: user.customerUid,
          rolloutId,
        });
        if (!owned) {
          return NextResponse.json({ error: "Rollout not found" }, { status: 404 });
        }
      }
      await markProductUpdateReviewed({
        customerUid: user.customerUid,
        releaseId: id,
      });
      await writeCustomerActivity({
        customerUid: user.customerUid,
        userId: user.id,
        eventType: "ar360.product_update.reviewed",
        title: "Product update reviewed",
        detail: `Release #${id}${rolloutId ? ` · rollout #${rolloutId}` : ""}`,
        meta: {
          releaseId: id,
          rolloutId: rolloutId || 0,
          informational: true,
          migratesProducts: false,
        },
      }).catch(() => undefined);
      return NextResponse.json({
        success: true,
        warning:
          "Product update review recorded. No product configuration was changed. Controlled rollout remains Phase 9 / Master Admin.",
      });
    }

    return NextResponse.json({ error: "Unknown action. Use view | review_product_update" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update view state";
    console.error("[account/platform/releases/:id POST]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
