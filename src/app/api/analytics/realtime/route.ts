import { NextResponse } from "next/server";
import { ensureAnalyticsSchema } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getRealtimeAnalytics } from "@/server/analytics/analytics.service";
import type { AnalyticsFilter } from "@/server/analytics/analytics.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await ensureAnalyticsSchema();
  schemaReady = true;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await ensureSchema();

    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const permission = await enforcePermission(user.customerUid ?? "", "analytics");
    if (!permission.ok) return permission.response;

    const { searchParams } = new URL(request.url);
    const filter: AnalyticsFilter = {
      customerUid: user.customerUid,
      productUid: searchParams.get("productUid") ?? undefined,
    };

    const data = await getRealtimeAnalytics(filter);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[analytics/realtime]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
