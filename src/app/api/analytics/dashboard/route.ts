import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getDashboardData } from "@/server/analytics/analytics.service";
import { getGrowthOverview } from "@/lib/growth/analytics.service";
import { generateGrowthInsights } from "@/lib/growth/insights.service";
import type { AnalyticsFilter } from "@/server/analytics/analytics.types";
import { requireApiUser } from "@/lib/auth";
import { ensureAnalyticsSchema } from "@/lib/db";

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
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      country: searchParams.get("country") ?? undefined,
    };

    const data = await getDashboardData(filter);
    const growth = await getGrowthOverview({
      customerUid: user.customerUid ?? "",
      from: filter.from,
      to: filter.to,
    });
    const insights = await generateGrowthInsights(user.customerUid ?? "");

    return NextResponse.json(
      {
        ...data,
        summary: {
          ...data.summary,
          shareViews: data.summary.shareViews ?? growth.shareViews,
          embedViews: data.summary.embedViews ?? growth.embedViews,
          ctaClicks: data.summary.ctaClicks ?? growth.ctaClicks,
          qrScans: data.summary.qrScans,
        },
        growth: {
          trafficSources: growth.trafficSources,
          insights,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[analytics/dashboard]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
