import { NextResponse } from "next/server";
import { ensureAnalyticsSchema } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import { cleanupAnalyticsData } from "@/server/analytics/analytics.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await ensureAnalyticsSchema();
  schemaReady = true;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    await ensureSchema();

    const user = await requireApiUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const permission = await enforcePermission(user.customerUid ?? "", "access_dashboard");
    if (!permission.ok) return permission.response;

    const body = await request.json().catch(() => ({}));
    const daysToKeep = Number(body.daysToKeep || 180);

    const result = await cleanupAnalyticsData(user.customerUid, daysToKeep);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[analytics/cleanup]", error);
    return NextResponse.json({ error: "Analytics cleanup failed." }, { status: 500 });
  }
}
