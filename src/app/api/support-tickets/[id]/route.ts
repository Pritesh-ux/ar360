import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimitForKey, getClientIp } from "@/lib/rate-limit";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import {
  getCustomerSupportTicket,
  replyToCustomerSupportTicket,
} from "@/lib/user-panel/support-tickets.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireScopedApiUser({ allowSuspended: true });
  if (!user) return rejectScopedApiUser();

  const { id } = await context.params;
  const ticket = await getCustomerSupportTicket(user.customerUid, id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found.", code: "SUPPORT_TICKET_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...ticket });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireScopedApiUser({ allowSuspended: true });
  if (!user) return rejectScopedApiUser();

  const ip = getClientIp(request);
  const limit = await enforceRateLimitForKey(`${user.id}:${ip}`, {
    scope: "support:reply",
    limit: 20,
    windowSec: 3600,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many replies. Try again later.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const result = await replyToCustomerSupportTicket({
    customerUid: user.customerUid,
    customerName: user.name || user.email,
    ticketUid: id,
    message: String(body.message || ""),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error, code: "SUPPORT_REPLY_FAILED" }, { status: 400 });
  }

  const ticket = await getCustomerSupportTicket(user.customerUid, id);
  return NextResponse.json({ success: true, ...ticket });
}
