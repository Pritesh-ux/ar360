import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAnalyticsSchema } from "@/lib/db";
import {
  buildViewerAnalyticsCsv,
  getViewerAnalyticsDashboard,
} from "@/lib/master-admin/viewer-analytics.service";
import { parsePagination } from "@/lib/master-admin/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("analytics.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  await ensureAnalyticsSchema();

  const { searchParams } = new URL(req.url);
  const exportFormat = searchParams.get("export");
  const { page, pageSize } = parsePagination(searchParams, { pageSize: 10 });

  try {
    const data = await getViewerAnalyticsDashboard({
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      customerUid: searchParams.get("customerUid") || undefined,
      productUid: searchParams.get("productUid") || undefined,
      search: searchParams.get("search") || undefined,
      page,
      pageSize,
    });

    if (exportFormat === "csv") {
      const csv = buildViewerAnalyticsCsv(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="viewer-analytics-${data.range.from}-${data.range.to}.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[master-admin/viewer-analytics]", error);
    return NextResponse.json(
      {
        summary: {
          totalViews: 0,
          arOpens: 0,
          qrScans: 0,
          uniqueVisitors: 0,
          avgSessionTime: "00:00",
          bounceRate: 0,
          totalViewsFmt: "0",
          arOpensFmt: "0",
          qrScansFmt: "0",
          trends: {},
          sparklines: {},
        },
        realtime: { activeViewers: 0, viewsLastHour: 0 },
        dailyViews: [],
        monthlyViews: [],
        devices: [],
        browsers: [],
        countries: [],
        trafficSources: [],
        productRanking: [],
        pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
        range: { from: "", to: "" },
        error: "Unable to load viewer analytics",
      },
      { status: 500 },
    );
  }
}
