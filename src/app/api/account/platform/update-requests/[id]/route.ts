import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import {
  getCustomerOwnedUpdateRequest,
  syncRequestStatusFromRollout,
} from "@/lib/platform-versioning/customer-update-request.service";
import { getCustomerRolloutDetail } from "@/lib/platform-versioning/customer-rollout.service";

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
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
    }

    let request = await getCustomerOwnedUpdateRequest({
      customerUid: user.customerUid,
      requestId: id,
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    request = (await syncRequestStatusFromRollout(request.id)) || request;

    let rolloutProgress = null;
    if (request.rolloutId) {
      const detail = await getCustomerRolloutDetail(request.rolloutId);
      if (detail && detail.rollout.customerUid === user.customerUid) {
        rolloutProgress = {
          rolloutId: detail.rollout.id,
          status: detail.rollout.status,
          progress: detail.progress,
        };
      }
    }

    return NextResponse.json({ success: true, request, rolloutProgress });
  } catch (error) {
    console.error("[account/platform/update-requests/:id GET]", error);
    return NextResponse.json({ error: "Unable to load request" }, { status: 500 });
  }
}
