import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  exportEmailLogsCsv,
  listEmailLogs,
  retryEmailLog,
  sendAdminEmail,
  type EmailCenterFilters,
} from "@/lib/master-admin/email-center.service";
import { paginationMeta } from "@/lib/master-admin/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilters(searchParams: URLSearchParams): EmailCenterFilters {
  return {
    search: (searchParams.get("search") || "").trim(),
    status: (searchParams.get("status") || "all").trim(),
    template: (searchParams.get("template") || "all").trim(),
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  };
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const filters = parseFilters(searchParams);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 15)));

  if (searchParams.get("export") === "csv") {
    const exportAuth = await guardAdminPermission(["settings.read", "exports.download"]);
    if (exportAuth instanceof NextResponse) return exportAuth;
    try {
      const csv = await exportEmailLogsCsv(filters);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="email-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } catch (error) {
      console.error("[master-admin/email-center export]", error);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  try {
    const data = await listEmailLogs({ ...filters, page, pageSize });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[master-admin/email-center]", error);
    return NextResponse.json({
      logs: [],
      pagination: paginationMeta(0, 1, pageSize),
      summary: { sent: 0, failed: 0, console: 0, total: 0, today: 0 },
      templates: [],
      templateBreakdown: [],
      error: "Unable to load email logs",
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "send");

  try {
    if (action === "retry") {
      const logId = Number(body.logId);
      if (!logId) return NextResponse.json({ error: "logId is required" }, { status: 400 });
      const result = await retryEmailLog(logId, admin.id);
      return NextResponse.json({ ok: true, result });
    }

    const result = await sendAdminEmail({
      to: String(body.to || ""),
      subject: String(body.subject || ""),
      body: String(body.body || ""),
      template: body.template || "custom",
      adminId: admin.id,
    });

    return NextResponse.json({
      ok: true,
      message: result.delivered
        ? `Email sent to ${body.to}.`
        : `Email logged (SMTP not configured). Recipient: ${body.to}.`,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email action failed" },
      { status: 400 },
    );
  }
}
