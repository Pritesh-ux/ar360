import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureSupportTicketsSchema } from "@/lib/db";
import {
  addTicketMessage,
  getTicketByUid,
  getTicketMessages,
  notifyTicketReply,
  updateTicket,
} from "@/lib/master-admin/support-tickets.service";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("tickets.read");
  if (auth instanceof NextResponse) return auth;

  await ensureSupportTicketsSchema();
  const { id } = await params;

  const ticket = await getTicketByUid(id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const messages = await getTicketMessages(id);
  return NextResponse.json({
    ticket,
    messages: messages.map((msg) => ({
      id: msg.id,
      authorType: msg.author_type,
      authorName: msg.author_name,
      body: msg.body,
      createdAt: msg.created_at,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("tickets.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureSupportTicketsSchema();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const existing = await getTicketByUid(id);
    if (!existing) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    await updateTicket(
      id,
      {
        status: body.status,
        priority: body.priority,
        assignedTo: body.assignedTo,
        category: body.category,
        subject: body.subject,
      },
      admin.id,
    );

    const reply = String(body.reply || body.message || "").trim();
    let emailResult = null;
    if (reply) {
      const adminName = String(
        (admin as { name?: string; email?: string }).name ||
          (admin as { email?: string }).email ||
          "Admin",
      );
      await addTicketMessage({
        ticketUid: id,
        authorType: "admin",
        authorName: adminName,
        body: reply,
      });
      const latestMessages = await getTicketMessages(id);
      const latestMsg = latestMessages[latestMessages.length - 1];

      if (!body.status) {
        await updateTicket(id, { status: "pending" }, admin.id);
      }

      emailResult = await notifyTicketReply({
        ticketNumber: existing.ticketNumber,
        customerEmail: existing.customerEmail,
        customerName: existing.customerName,
        subject: existing.subject,
        reply,
      }).catch((error) => ({
        delivered: false,
        mode: "failed" as const,
        error: error instanceof Error ? error.message : "Email failed",
      }));

      const { createCustomerNotification } = await import("@/lib/account/notify.service");
      await createCustomerNotification({
        customerUid: existing.customerUid,
        category: "support",
        title: "Support replied to your ticket",
        body: `${existing.subject} — new reply from AR360 Support.`,
        href: `/dashboard/support?ticket=${id}`,
        dedupeKey: `support-reply:${id}:${latestMsg?.id ?? Date.now()}`,
      });

      await writeMasterAdminAudit({
        adminId: admin.id,
        action: "ticket.reply",
        entityType: "support_ticket",
        entityId: id,
        metadata: { emailDelivered: emailResult && "delivered" in emailResult ? emailResult.delivered : false },
      });
    }

    const ticket = await getTicketByUid(id);
    const messages = await getTicketMessages(id);
    return NextResponse.json({
      ok: true,
      ticket,
      messages: messages.map((msg) => ({
        id: msg.id,
        authorType: msg.author_type,
        authorName: msg.author_name,
        body: msg.body,
        createdAt: msg.created_at,
      })),
      email: emailResult,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}
