import { NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getGrowthOverview, getProductGrowthAnalytics } from "@/lib/growth/analytics.service";
import { generateGrowthInsights } from "@/lib/growth/insights.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const permission = await enforcePermission(user.customerUid, "analytics");
  if (!permission.ok) return permission.response;

  const { searchParams } = new URL(request.url);
  const productUid = searchParams.get("productUid") || undefined;
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const includeInsights = searchParams.get("insights") === "1";

  const overview = productUid
    ? await getProductGrowthAnalytics({ customerUid: user.customerUid, productUid, from, to })
    : await getGrowthOverview({ customerUid: user.customerUid, from, to });

  const insights = includeInsights ? await generateGrowthInsights(user.customerUid) : [];

  return NextResponse.json({ success: true, overview, insights });
}
