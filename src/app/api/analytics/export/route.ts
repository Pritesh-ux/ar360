import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enforcePermission } from "@/lib/billing/api-permission";
import { getAnalyticsExportRows, toCsv } from "@/server/analytics/analytics.export";

export const runtime = "nodejs";

function getParam(url: URL, key: string) {
  return String(url.searchParams.get(key) || "").trim();
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }

    const permission = await enforcePermission(user.customerUid ?? "", "analytics");
    if (!permission.ok) return permission.response;

    const url = new URL(req.url);
    const customerUid = getParam(url, "customerUid") || user.customerUid || "";
    const productUid = getParam(url, "productUid") || undefined;
    const from = getParam(url, "from") || undefined;
    const to = getParam(url, "to") || undefined;
    const event = getParam(url, "event") || undefined;
    const format = (getParam(url, "format") || "excel").toLowerCase();

    if (format === "json" || format === "csv") {
      return NextResponse.json({ error: "Only Excel export is available." }, { status: 400 });
    }

    if (!customerUid) {
      return NextResponse.json({ error: "customerUid is required." }, { status: 400 });
    }

    if (user.customerUid && user.customerUid !== customerUid) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const rows = await getAnalyticsExportRows({ customerUid, productUid, from, to, event });
    const csv = `\uFEFF${toCsv(rows)}`;
    const stamp = [from, to].filter(Boolean).join("-") || new Date().toISOString().slice(0, 10);
    const fileName = `analytics-${stamp}.xls`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[analytics/export]", error);
    return NextResponse.json({ error: "Analytics export failed." }, { status: 500 });
  }
}
