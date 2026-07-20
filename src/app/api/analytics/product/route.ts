import { requireApiUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getDashboardData } from "@/server/analytics/analytics.service";
import type { AnalyticsFilter } from "@/server/analytics/analytics.types";
import { ensureAnalyticsSchema } from "@/lib/db";
import { NextResponse } from "next/server";

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

    const permission = await enforcePermission(user.customerUid ?? "", "access_dashboard");
    if (!permission.ok) return permission.response;

    const { searchParams } = new URL(request.url);
    const productUid = searchParams.get("productUid");

    if (!productUid) {
      return NextResponse.json({ error: "productUid is required" }, { status: 400 });
    }

    const filter: AnalyticsFilter = {
      customerUid: user.customerUid,
      productUid,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    };

    const data = await getDashboardData(filter);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[analytics/product]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
