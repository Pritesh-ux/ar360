import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureSiteWebAnalyticsSchema } from "@/lib/db";
import {
  getLiveWebAnalytics,
  getWebAnalyticsDevices,
  getWebAnalyticsHourlyToday,
  getWebAnalyticsLocations,
  getWebAnalyticsOverview,
  getWebAnalyticsPages,
  getWebAnalyticsSources,
  getWebAnalyticsTimeseries,
  getWebVisitorDetail,
  cleanupWebAnalytics,
} from "@/lib/web-analytics/service";
import { buildDateRange } from "@/server/analytics/analytics.middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let schemaReady = false;
async function ensure() {
  if (schemaReady) return;
  await ensureSiteWebAnalyticsSchema();
  schemaReady = true;
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("analytics.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  try {
    await ensure();
    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section") || "overview";
    const { fromDate, toDate } = buildDateRange(
      searchParams.get("from") || undefined,
      searchParams.get("to") || undefined,
    );
    const from = `${fromDate} 00:00:00`;
    const to = `${toDate} 23:59:59`;

    if (section === "live") {
      const data = await getLiveWebAnalytics({
        device: searchParams.get("device") || undefined,
        country: searchParams.get("country") || undefined,
        browser: searchParams.get("browser") || undefined,
        os: searchParams.get("os") || undefined,
        status: searchParams.get("status") || undefined,
        search: searchParams.get("search") || undefined,
        visitorType: searchParams.get("visitorType") || undefined,
        source: searchParams.get("source") || undefined,
      });
      return NextResponse.json({ ...data, range: { from: fromDate, to: toDate } });
    }

    if (section === "overview") {
      const rangeParam = searchParams.get("range");
      const days =
        rangeParam === "1" || rangeParam === "today"
          ? "1"
          : rangeParam === "30"
            ? "30"
            : rangeParam === "7"
              ? "7"
              : fromDate && toDate
                ? String(
                    Math.max(
                      1,
                      Math.round(
                        (new Date(`${toDate}T12:00:00`).getTime() -
                          new Date(`${fromDate}T12:00:00`).getTime()) /
                          86400000,
                      ) + 1,
                    ),
                  )
                : "7";
      const [overview, hourly, timeseries] = await Promise.all([
        getWebAnalyticsOverview(),
        getWebAnalyticsHourlyToday(),
        getWebAnalyticsTimeseries(days),
      ]);
      return NextResponse.json({ overview, hourly, timeseries, range: { from: fromDate, to: toDate } });
    }

    if (section === "pages") {
      return NextResponse.json({
        pages: await getWebAnalyticsPages(from, to),
        range: { from: fromDate, to: toDate },
      });
    }

    if (section === "sources") {
      return NextResponse.json({
        sources: await getWebAnalyticsSources(from, to),
        range: { from: fromDate, to: toDate },
      });
    }

    if (section === "devices") {
      return NextResponse.json({
        ...(await getWebAnalyticsDevices(from, to)),
        range: { from: fromDate, to: toDate },
      });
    }

    if (section === "locations") {
      const locations = await getWebAnalyticsLocations(from, to);
      return NextResponse.json({
        locations: locations.countries,
        cities: locations.cities,
        range: { from: fromDate, to: toDate },
      });
    }

    if (section === "visitor") {
      const visitorId = String(searchParams.get("visitorId") || "").trim();
      if (!visitorId) {
        return NextResponse.json({ error: "visitorId required" }, { status: 400 });
      }
      const visitor = await getWebVisitorDetail(visitorId);
      if (!visitor) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ visitor });
    }

    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  } catch (error) {
    console.error("[master-admin/web-analytics]", error);
    return NextResponse.json(
      { error: "Analytics temporarily unavailable" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("analytics.read", { request: req });
  if (auth instanceof NextResponse) return auth;

  try {
    await ensure();
    const body = (await req.json().catch(() => ({}))) as { action?: string; retentionDays?: number };
    if (body.action === "cleanup") {
      const result = await cleanupWebAnalytics(body.retentionDays);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[master-admin/web-analytics POST]", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
