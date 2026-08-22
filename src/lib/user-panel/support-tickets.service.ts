import { query } from "@/lib/db";
import { createTicket, mapTicketRow } from "@/lib/master-admin/support-tickets.service";
import { paginationMeta } from "@/lib/master-admin/pagination";
import {
  DEMO_SUPPORT_CUSTOMER_UID_PREFIX,
  ensureDemoSupportTicketsRepaired,
} from "@/lib/seed/demo-support-tickets";

export type SupportTicketStatusFilter = "all" | "open" | "pending" | "resolved" | "closed";

type TicketRow = {
  ticket_uid: string;
  ticket_number: string;
  customer_uid: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  process_status: string | null;
  assigned_to: string;
  created_at: string;
  updated_at: string;
};

export type CustomerTicketStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
};

export async function getCustomerTicketStats(customerUid: string): Promise<CustomerTicketStats> {
  const rows = await query<{
    total: number;
    open_count: number;
    pending_count: number;
    resolved_count: number;
  }>(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS resolved_count
     FROM support_tickets
     WHERE customer_uid = ?
       AND customer_uid NOT LIKE ?`,
    [customerUid, `${DEMO_SUPPORT_CUSTOMER_UID_PREFIX}%`],
  );

  const row = rows[0];
  return {
    total: Number(row?.total || 0),
    open: Number(row?.open_count || 0),
    inProgress: Number(row?.pending_count || 0),
    resolved: Number(row?.resolved_count || 0),
  };
}

export async function listCustomerSupportTickets(input: {
  customerUid: string;
  status?: SupportTicketStatusFilter;
  page?: number;
  pageSize?: number;
}) {
  await ensureDemoSupportTicketsRepaired();

  const page = Math.max(1, input.page || 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize || 10));
  const offset = (page - 1) * pageSize;

  const conditions = ["customer_uid = ?", "customer_uid NOT LIKE ?"];
  const values: (string | number)[] = [input.customerUid, `${DEMO_SUPPORT_CUSTOMER_UID_PREFIX}%`];

  if (input.status && input.status !== "all") {
    conditions.push("status = ?");
    values.push(input.status);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [rows, countRows, stats] = await Promise.all([
    query<TicketRow>(
      `SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
              subject, description, category, priority, status, process_status, assigned_to, created_at, updated_at
       FROM support_tickets
       ${where}
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, pageSize, offset],
    ),
    query<{ total: number }>(`SELECT COUNT(*) AS total FROM support_tickets ${where}`, values),
    getCustomerTicketStats(input.customerUid),
  ]);

  const total = Number(countRows[0]?.total || 0);

  return {
    tickets: rows.map(mapTicketRow),
    stats,
    pagination: paginationMeta(total, page, pageSize),
  };
}

export async function createCustomerSupportTicket(input: {
  customerUid: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description?: string;
  category?: "technical" | "billing" | "account" | "feature" | "other";
}) {
  return createTicket({
    customerUid: input.customerUid,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    subject: input.subject,
    description: input.description,
    category: input.category || "technical",
    priority: "medium",
  });
}

export async function getCustomerSupportTicket(customerUid: string, ticketUid: string) {
  const rows = await query<TicketRow>(
    `SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
            subject, description, category, priority, status, process_status, assigned_to, created_at, updated_at
     FROM support_tickets
     WHERE ticket_uid = ? AND customer_uid = ?
       AND customer_uid NOT LIKE ?
     LIMIT 1`,
    [ticketUid, customerUid, `${DEMO_SUPPORT_CUSTOMER_UID_PREFIX}%`],
  );
  if (!rows.length) return null;

  const messages = await query<{
    author_type: string;
    author_name: string;
    body: string;
    created_at: string;
  }>(
    `SELECT author_type, author_name, body, created_at
     FROM support_ticket_messages
     WHERE ticket_uid = ? AND is_internal = 0
     ORDER BY created_at ASC`,
    [ticketUid],
  );

  return {
    ticket: mapTicketRow(rows[0]),
    messages: messages.map((m) => ({
      senderType: m.author_type,
      senderName: m.author_name,
      message: m.body,
      createdAt: m.created_at,
    })),
  };
}

export async function replyToCustomerSupportTicket(input: {
  customerUid: string;
  customerName: string;
  ticketUid: string;
  message: string;
}) {
  const ticket = await getCustomerSupportTicket(input.customerUid, input.ticketUid);
  if (!ticket) return { error: "Support ticket not found." as const };

  const body = input.message.trim();
  if (!body || body.length > 5000) return { error: "Message is required and must be under 5000 characters." as const };

  const { addTicketMessage } = await import("@/lib/master-admin/support-tickets.service");
  await addTicketMessage({
    ticketUid: input.ticketUid,
    authorType: "customer",
    authorName: input.customerName,
    body,
  });

  await query(
    `UPDATE support_tickets SET status = 'pending', updated_at = NOW() WHERE ticket_uid = ? AND customer_uid = ?`,
    [input.ticketUid, input.customerUid],
  );

  const { writeCustomerActivity } = await import("@/lib/account/activity.service");
  await writeCustomerActivity({
    customerUid: input.customerUid,
    eventType: "support_reply_sent",
    title: "Support reply sent",
    detail: `Reply sent on ticket ${ticket.ticket.ticketNumber}.`,
  });

  const { createAdminNotification } = await import("@/lib/master-admin/notifications");
  await createAdminNotification({
    notificationUid: `support-ticket:customer-reply:${input.ticketUid}:${Date.now()}`,
    category: "support",
    title: `Customer replied — ${ticket.ticket.ticketNumber}`,
    body: `${input.customerName}: ${body.slice(0, 200)}${body.length > 200 ? "…" : ""}`,
    href: "/master-admin/support-tickets",
  }).catch(() => {});

  return { success: true as const };
}
