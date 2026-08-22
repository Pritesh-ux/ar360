import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { cancelCustomerUpdateRequest } from "@/lib/platform-versioning/customer-update-request.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: Ctx) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  try {
    const { id: raw } = await context.params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
    }

    const request = await cancelCustomerUpdateRequest({
      customerUid: user.customerUid,
      requestId: id,
    });

    await writeCustomerActivity({
      customerUid: user.customerUid,
      userId: user.id,
      eventType: "ar360.customer_update.cancelled",
      title: "Product update request cancelled",
      detail: `Request #${id}`,
      meta: { requestId: id, migratesProducts: false },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, request });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to cancel";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: string }).code)
        : "CANCEL_FAILED";
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
