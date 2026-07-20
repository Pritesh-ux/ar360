import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import {
  getUserDashboardOverview,
  type DashboardRangeKey,
} from "@/lib/user-panel/dashboard.service";
import {
  rejectScopedApiUser,
  requireScopedApiUser,
} from "@/lib/user-panel/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGE_KEYS = new Set<DashboardRangeKey>(["7d", "30d", "month", "year"]);

export async function GET(request: Request) {
  try {
    const user = await requireScopedApiUser();
    if (!user) return rejectScopedApiUser();

    const permission = await enforcePermission(user.customerUid, "access_dashboard");
    if (!permission.ok) return permission.response;

    const { searchParams } = new URL(request.url);
    const rangeParam = searchParams.get("range");
    const range = RANGE_KEYS.has(rangeParam as DashboardRangeKey)
      ? (rangeParam as DashboardRangeKey)
      : "30d";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const data = await getUserDashboardOverview({
      customerUid: user.customerUid,
      userName: user.name,
      range,
      from,
      to,
    });

    const { maybeNotifyUsageThresholds } = await import("@/lib/account/usage-notify.service");
    void maybeNotifyUsageThresholds(user.customerUid);

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("[dashboard/overview]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
