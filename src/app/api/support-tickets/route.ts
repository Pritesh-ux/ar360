import { NextRequest, NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/master-admin-settings";
import { enforceRateLimitForKey, getClientIp } from "@/lib/rate-limit";
import {
  createCustomerSupportTicket,
  listCustomerSupportTickets,
  type SupportTicketStatusFilter,
} from "@/lib/user-panel/support-tickets.service";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { writeCustomerActivity } from "@/lib/account/activity.service";
import { createCustomerNotification } from "@/lib/account/notify.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FILTERS = new Set<SupportTicketStatusFilter>(["all", "open", "pending", "resolved", "closed"]);

export async function GET(request: NextRequest) {
  try {
    const user = await requireScopedApiUser();
    if (!user) return rejectScopedApiUser();

    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const status = STATUS_FILTERS.has(statusParam as SupportTicketStatusFilter)
      ? (statusParam as SupportTicketStatusFilter)
      : "all";

    const [data, settings] = await Promise.all([
      listCustomerSupportTickets({
        customerUid: user.customerUid,
        status,
        page: Number(searchParams.get("page") || "1"),
        pageSize: Number(searchParams.get("pageSize") || "10"),
      }),
      getPlatformSettings().catch(() => null),
    ]);

    return NextResponse.json({
      success: true,
      ...data,
      supportEmail: settings?.supportEmail || "support@ar360.studio",
    });
  } catch (error) {
    console.error("[support-tickets GET]", error);
    return NextResponse.json({ error: "Failed to load support tickets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireScopedApiUser();
    if (!user) return rejectScopedApiUser();

    const ip = getClientIp(request);
    const limit = await enforceRateLimitForKey(`${user.id}:${ip}`, {
      scope: "support:create",
      limit: 10,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many tickets. Try again later.", code: "RATE_LIMITED" }, { status: 429 });
    }

    const body = await request.json();
    const subject = String(body.subject || "").trim();
    const description = String(body.description || "").trim();
    const category = body.category as "technical" | "billing" | "account" | "feature" | "other" | undefined;

    if (!subject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    const customerName = user.name?.trim() || user.email?.split("@")[0] || "Customer";
    const customerEmail = user.email?.trim() || "";

    if (!customerEmail) {
      return NextResponse.json({ error: "Account email is required to create a ticket." }, { status: 400 });
    }

    const ticket = await createCustomerSupportTicket({
      customerUid: user.customerUid,
      customerName,
      customerEmail,
      subject,
      description,
      category: category || "technical",
    });

    await writeCustomerActivity({
      customerUid: user.customerUid,
      userId: user.id,
      eventType: "support_ticket_created",
      title: "Support ticket created",
      detail: subject,
    });

    await createCustomerNotification({
      customerUid: user.customerUid,
      userId: user.id,
      category: "support",
      title: "Support ticket created",
      body: `We received your request: ${subject}`,
      href: `/dashboard/support?ticket=${ticket.ticketUid}`,
      dedupeKey: `support-created:${ticket.ticketUid}`,
    });

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error("[support-tickets POST]", error);
    const message = error instanceof Error ? error.message : "Failed to create support ticket.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
