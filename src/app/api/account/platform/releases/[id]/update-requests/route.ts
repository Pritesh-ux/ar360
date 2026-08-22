import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { createCustomerUpdateRequest } from "@/lib/platform-versioning/customer-update-request.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const { id: raw } = await context.params;
    const releaseId = Number(raw);
    if (!Number.isInteger(releaseId) || releaseId <= 0) {
      return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const productIds = Array.isArray(body.productIds)
      ? body.productIds.map(String)
      : [];
    const acknowledged = Boolean(body.acknowledged);

    if (!acknowledged) {
      return NextResponse.json(
        { error: "You must confirm that you reviewed the proposed product updates." },
        { status: 400 },
      );
    }

    // Never trust customer_uid from body
    const request = await createCustomerUpdateRequest({
      customerUid: user.customerUid,
      releaseId,
      productIds,
      requestedByUserId: user.id,
      notes: body.notes ? String(body.notes) : undefined,
    });

    await writeCustomerActivity({
      customerUid: user.customerUid,
      userId: user.id,
      eventType: "ar360.customer_update.requested",
      title: "Product update requested",
      detail: `Release #${releaseId} · ${productIds.length} product(s) · ${request.status}`,
      meta: {
        requestId: request.id,
        releaseId,
        status: request.status,
        migratesProducts: false,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      request,
      warning:
        "Request recorded. Product configuration was NOT changed. Controlled rollout remains Master Admin / Phase 9.",
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "REQUEST_FAILED";
    const message = error instanceof Error ? error.message : "Unable to create request";
    console.error("[account/platform/releases/:id/update-requests POST]", error);
    const status =
      code === "AUTO_EXECUTION_DISABLED"
        ? 403
        : code === "CROSS_CUSTOMER_PRODUCT"
          ? 403
          : code === "EMPTY_SELECTION" || code === "PRODUCT_NOT_ELIGIBLE"
            ? 400
            : code === "DRAFT_RELEASE_REJECTED" || code === "ARCHIVED_RELEASE_REJECTED"
              ? 400
              : 400;
    return NextResponse.json({ error: message, code }, { status });
  }
}
