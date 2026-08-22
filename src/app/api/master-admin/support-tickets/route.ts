import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureSupportTicketsSchema } from "@/lib/db";
import {
  createTicket,
  exportTicketsCsv,
  getTicketAnalytics,
  getTicketAssigneeOptions,
  getTicketByUid,
  listSupportTickets,
  type TicketFilterParams,
} from "@/lib/master-admin/support-tickets.service";
import { paginationMeta } from "@/lib/master-admin/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFilters(searchParams: URLSearchParams): TicketFilterParams {
  return {
    search: (searchParams.get("search") || "").trim(),
    status: (searchParams.get("status") || "all").trim(),
    priority: (searchParams.get("priority") || "all").trim(),
    assigned: (searchParams.get("assigned") || "all").trim(),
    category: (searchParams.get("category") || "all").trim(),
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  };
}

export async function GET(req: NextRequest) {
  const auth = await guardAdminPermission("tickets.read");
  if (auth instanceof NextResponse) return auth;

  await ensureSupportTicketsSchema();

  const { searchParams } = new URL(req.url);
  const filters = parseFilters(searchParams);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 8)));

  if (searchParams.get("export") === "csv") {
    const exportAuth = await guardAdminPermission(["tickets.read", "exports.download"]);
    if (exportAuth instanceof NextResponse) return exportAuth;
    try {
      const csv = await exportTicketsCsv(filters);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="support-tickets-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    } catch (error) {
      console.error("[master-admin/support-tickets export]", error);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  try {
    const [list, analytics, assigneeOptions] = await Promise.all([
      listSupportTickets({ ...filters, page, pageSize }),
      getTicketAnalytics(filters),
      getTicketAssigneeOptions(),
    ]);

    return NextResponse.json({
      tickets: list.tickets,
      pagination: list.pagination,
      summary: analytics.summary,
      analytics: analytics.analytics,
      assigneeOptions,
    });
  } catch (error) {
    console.error("[master-admin/support-tickets]", error);
    return NextResponse.json({
      tickets: [],
      pagination: paginationMeta(0, 1, pageSize),
      summary: { open: 0, pending: 0, resolved: 0, closed: 0, totalCount: 0, avgResolutionLabel: "—" },
      analytics: { statusBreakdown: [], categoryBreakdown: [], openAging: [] },
      assigneeOptions: [],
      error: "Unable to load support tickets",
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("tickets.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureSupportTicketsSchema();
  const body = await req.json().catch(() => ({}));

  try {
    const created = await createTicket(
      {
        customerUid: body.customerUid,
        customerName: String(body.customerName || ""),
        customerEmail: String(body.customerEmail || ""),
        subject: String(body.subject || ""),
        description: String(body.description || ""),
        category: body.category,
        priority: body.priority,
        assignedTo: body.assignedTo,
      },
      admin.id,
    );

    const ticket = await getTicketByUid(created.ticketUid);
    await logAdminAudit(admin, "ticket.create", "support_ticket", created.ticketUid);
    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Create failed" },
      { status: 400 },
    );
  }
}
