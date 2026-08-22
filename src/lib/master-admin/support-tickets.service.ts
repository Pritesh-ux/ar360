import crypto from "crypto";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email/send-email";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { paginationMeta } from "@/lib/master-admin/pagination";
import {
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketStatusLabel,
} from "@/components/features/master-admin/support-tickets-utils";

export type TicketInput = {
  customerUid?: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description?: string;
  category?: "technical" | "billing" | "account" | "feature" | "other";
  priority?: "low" | "medium" | "high";
  assignedTo?: string;
};

export type TicketFilterParams = {
  search?: string;
  status?: string;
  priority?: string;
  assigned?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
};

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

function ticketUid() {
  return `tkt_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export function mapTicketRow(row: TicketRow) {
  return {
    id: row.ticket_uid,
    ticketNumber: row.ticket_number,
    customerUid: row.customer_uid,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    subject: row.subject,
    description: row.description || "",
    category: row.category,
    categoryLabel: ticketCategoryLabel(row.category),
    priority: ticketPriorityLabel(row.priority),
    rawPriority: row.priority,
    status: ticketStatusLabel(row.status),
    rawStatus: row.status,
    processStatus: row.process_status || "",
    assignedTo: row.assigned_to || "Unassigned",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildTicketWhere(params: TicketFilterParams) {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  const search = (params.search || "").trim().toLowerCase();

  if (search) {
    conditions.push(`(
      LOWER(ticket_number) LIKE ?
      OR LOWER(subject) LIKE ?
      OR LOWER(customer_name) LIKE ?
      OR LOWER(customer_email) LIKE ?
      OR LOWER(description) LIKE ?
    )`);
    const like = `%${search}%`;
    values.push(like, like, like, like, like);
  }
  if (params.status && params.status !== "all") {
    conditions.push("status = ?");
    values.push(params.status.toLowerCase());
  }
  if (params.priority && params.priority !== "all") {
    conditions.push("priority = ?");
    values.push(params.priority.toLowerCase());
  }
  if (params.category && params.category !== "all") {
    conditions.push("category = ?");
    values.push(params.category.toLowerCase());
  }
  if (params.assigned && params.assigned !== "all") {
    if (params.assigned === "unassigned") {
      conditions.push("(assigned_to = '' OR assigned_to = 'Unassigned')");
    } else {
      conditions.push("assigned_to = ?");
      values.push(params.assigned);
    }
  }
  if (params.dateFrom) {
    conditions.push("DATE(created_at) >= ?");
    values.push(params.dateFrom);
  }
  if (params.dateTo) {
    conditions.push("DATE(created_at) <= ?");
    values.push(params.dateTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

export async function getTicketAssigneeOptions() {
  const rows = await query<{ name: string }>(
    `SELECT name FROM master_admins WHERE status = 'Active' ORDER BY name ASC`,
  ).catch(() => []);

  const fromTickets = await query<{ assigned_to: string }>(`
    SELECT DISTINCT assigned_to
    FROM support_tickets
    WHERE assigned_to != '' AND assigned_to != 'Unassigned'
    ORDER BY assigned_to ASC
  `).catch(() => []);

  const names = [
    ...rows.map((row) => row.name),
    ...fromTickets.map((row) => row.assigned_to),
  ].filter(Boolean);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export async function listSupportTickets(params: TicketFilterParams & { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(params.pageSize || 8)));
  const offset = (page - 1) * pageSize;
  const { where, values } = buildTicketWhere(params);

  const [countRows, rows] = await Promise.all([
    query<{ total: number }>(`SELECT COUNT(*) AS total FROM support_tickets ${where}`, values),
    query<TicketRow>(`
      SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
        subject, description, category, priority, status, process_status, assigned_to, created_at, updated_at
      FROM support_tickets
      ${where}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `, [...values, pageSize, offset]),
  ]);

  return {
    tickets: rows.map(mapTicketRow),
    pagination: paginationMeta(Number(countRows[0]?.total || 0), page, pageSize),
  };
}

export async function getTicketAnalytics(params: TicketFilterParams) {
  const { where, values } = buildTicketWhere(params);

  const [summaryRows, statusRows, categoryRows, resolutionRows, openAgingRows] = await Promise.all([
    query<any>(`
      SELECT
        SUM(status = 'open') AS openCount,
        SUM(status = 'pending') AS pendingCount,
        SUM(status = 'resolved') AS resolvedCount,
        SUM(status = 'closed') AS closedCount,
        COUNT(*) AS totalCount
      FROM support_tickets
      ${where}
    `, values),

    query<{ status: string; count: number }>(`
      SELECT status, COUNT(*) AS count
      FROM support_tickets
      ${where}
      GROUP BY status
    `, values),

    query<{ category: string; count: number }>(`
      SELECT category, COUNT(*) AS count
      FROM support_tickets
      ${where}
      GROUP BY category
      ORDER BY count DESC
    `, values),

    query<{ avgHours: number | null }>(`
      SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) AS avgHours
      FROM support_tickets
      ${where ? `${where} AND status IN ('resolved', 'closed')` : "WHERE status IN ('resolved', 'closed')"}
    `, values),

    query<{ bucket: string; count: number }>(`
      SELECT
        CASE
          WHEN TIMESTAMPDIFF(DAY, created_at, NOW()) <= 1 THEN '0-1 days'
          WHEN TIMESTAMPDIFF(DAY, created_at, NOW()) <= 3 THEN '2-3 days'
          WHEN TIMESTAMPDIFF(DAY, created_at, NOW()) <= 7 THEN '4-7 days'
          ELSE '7+ days'
        END AS bucket,
        COUNT(*) AS count
      FROM support_tickets
      ${where ? `${where} AND status IN ('open', 'pending')` : "WHERE status IN ('open', 'pending')"}
      GROUP BY bucket
    `, values),
  ]);

  const summaryRow = summaryRows[0] || {};
  const totalCount = Number(summaryRow.totalCount || 0);

  const statusBreakdown = ["open", "pending", "resolved", "closed"].map((key) => {
    const match = statusRows.find((r) => r.status === key);
    const count = Number(match?.count || 0);
    return {
      status: ticketStatusLabel(key),
      key,
      count,
      percent: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
    };
  });

  const categoryTotal = categoryRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const categoryBreakdown = categoryRows.map((row) => ({
    category: row.category,
    label: ticketCategoryLabel(row.category),
    count: Number(row.count || 0),
    percent: categoryTotal > 0 ? Math.round((Number(row.count) / categoryTotal) * 1000) / 10 : 0,
  }));

  const avgResolutionHours = Number(resolutionRows[0]?.avgHours || 0);
  const avgResolutionLabel =
    avgResolutionHours > 0
      ? avgResolutionHours >= 24
        ? `${Math.round((avgResolutionHours / 24) * 10) / 10} days avg`
        : `${Math.round(avgResolutionHours)} hours avg`
      : "No resolved tickets in filter";

  return {
    summary: {
      open: Number(summaryRow.openCount || 0),
      pending: Number(summaryRow.pendingCount || 0),
      resolved: Number(summaryRow.resolvedCount || 0),
      closed: Number(summaryRow.closedCount || 0),
      totalCount,
      avgResolutionLabel,
    },
    analytics: {
      statusBreakdown,
      categoryBreakdown,
      openAging: openAgingRows.map((row) => ({
        bucket: row.bucket,
        count: Number(row.count || 0),
      })),
    },
  };
}

export async function exportTicketsCsv(params: TicketFilterParams) {
  const { where, values } = buildTicketWhere(params);
  const rows = await query<TicketRow>(`
    SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
      subject, description, category, priority, status, process_status, assigned_to, created_at, updated_at
    FROM support_tickets
    ${where}
    ORDER BY updated_at DESC
    LIMIT 5000
  `, values);

  const header = [
    "Ticket ID",
    "Customer",
    "Email",
    "Subject",
    "Category",
    "Priority",
    "Status",
    "Assigned To",
    "Created At",
    "Last Updated",
  ];
  const lines = rows.map((row) => {
    const ticket = mapTicketRow(row);
    return [
      ticket.ticketNumber,
      ticket.customerName,
      ticket.customerEmail,
      ticket.subject,
      ticket.categoryLabel,
      ticket.priority,
      ticket.status,
      ticket.assignedTo,
      ticket.createdAt,
      ticket.updatedAt,
    ];
  });

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const prefix = `TK-${year}-`;
  const rows = await query<{ ticket_number: string }>(
    `SELECT ticket_number FROM support_tickets
     WHERE ticket_number LIKE ?
     ORDER BY ticket_number DESC LIMIT 1`,
    [`${prefix}%`],
  );
  const last = rows[0]?.ticket_number || "";
  const seq = Number(last.split("-").pop() || 0);
  const next = seq + 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

export async function createTicket(input: TicketInput, adminId?: number) {
  if (!input.customerName.trim()) throw new Error("Customer name is required");
  if (!input.customerEmail.trim()) throw new Error("Customer email is required");
  if (!input.subject.trim()) throw new Error("Subject is required");

  const uid = ticketUid();
  const ticketNumber = await nextTicketNumber();
  const category = input.category || "technical";
  const priority = input.priority || "medium";
  const assignedTo = input.assignedTo || "";

  await query(
    `INSERT INTO support_tickets (
      ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
      subject, description, category, priority, status, assigned_to
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      uid,
      ticketNumber,
      input.customerUid || "",
      input.customerName.trim(),
      input.customerEmail.trim(),
      input.subject.trim(),
      input.description || "",
      category,
      priority,
      assignedTo,
    ],
  );

  if (input.description?.trim()) {
    await addTicketMessage({
      ticketUid: uid,
      authorType: "customer",
      authorName: input.customerName.trim(),
      body: input.description.trim(),
    });
  }

  await writeMasterAdminAudit({
    adminId,
    action: "ticket.create",
    entityType: "support_ticket",
    entityId: uid,
    metadata: { ticketNumber, priority, category },
  });

  const { createAdminNotification } = await import("@/lib/master-admin/notifications");
  await createAdminNotification({
    notificationUid: `support-ticket:created:${uid}`,
    category: "support",
    title: `New support ticket ${ticketNumber}`,
    body: `${input.customerName.trim()} — ${input.subject.trim()}`,
    href: "/master-admin/support-tickets",
  }).catch(() => {});

  return { ticketUid: uid, ticketNumber };
}

export async function addTicketMessage(input: {
  ticketUid: string;
  authorType?: "admin" | "customer" | "system";
  authorName: string;
  body: string;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Message body is required");

  await query(
    `INSERT INTO support_ticket_messages (ticket_uid, author_type, author_name, body)
     VALUES (?, ?, ?, ?)`,
    [input.ticketUid, input.authorType || "admin", input.authorName, body],
  );

  await query(
    "UPDATE support_tickets SET updated_at = NOW() WHERE ticket_uid = ?",
    [input.ticketUid],
  );
}

export async function notifyTicketReply(input: {
  ticketNumber: string;
  customerEmail: string;
  customerName: string;
  subject: string;
  reply: string;
}) {
  if (!input.customerEmail) return { delivered: false, mode: "skipped" as const };

  return sendEmail({
    to: input.customerEmail,
    subject: `Re: ${input.subject} [${input.ticketNumber}]`,
    template: "support_ticket_reply",
    text: `Hello ${input.customerName},\n\n${input.reply}\n\n— AR360 Support`,
    html: `<p>Hello ${input.customerName},</p><p>${input.reply.replace(/\n/g, "<br/>")}</p><p>— AR360 Support</p>`,
  });
}

export async function updateTicket(
  ticketUid: string,
  input: {
    status?: "open" | "pending" | "resolved" | "closed";
    priority?: "low" | "medium" | "high";
    assignedTo?: string;
    category?: "technical" | "billing" | "account" | "feature" | "other";
    subject?: string;
    processStatus?: string;
  },
  adminId?: number,
) {
  const rows = await query<{ ticket_uid: string }>(
    "SELECT ticket_uid FROM support_tickets WHERE ticket_uid = ? LIMIT 1",
    [ticketUid],
  );
  if (!rows[0]) throw new Error("Ticket not found");

  const sets: string[] = [];
  const values: string[] = [];

  if (input.status !== undefined) {
    sets.push("status = ?");
    values.push(input.status);
  }
  if (input.priority !== undefined) {
    sets.push("priority = ?");
    values.push(input.priority);
  }
  if (input.assignedTo !== undefined) {
    sets.push("assigned_to = ?");
    values.push(input.assignedTo);
  }
  if (input.category !== undefined) {
    sets.push("category = ?");
    values.push(input.category);
  }
  if (input.subject !== undefined) {
    sets.push("subject = ?");
    values.push(input.subject);
  }
  if (input.processStatus !== undefined) {
    sets.push("process_status = ?");
    values.push(input.processStatus);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = NOW()");
  values.push(ticketUid);
  await query(`UPDATE support_tickets SET ${sets.join(", ")} WHERE ticket_uid = ?`, values);

  await writeMasterAdminAudit({
    adminId,
    action: "ticket.update",
    entityType: "support_ticket",
    entityId: ticketUid,
    metadata: { fields: Object.keys(input) },
  });
}

export async function getTicketByUid(ticketUid: string) {
  const rows = await query<TicketRow>(
    `SELECT ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
      subject, description, category, priority, status, process_status, assigned_to, created_at, updated_at
     FROM support_tickets WHERE ticket_uid = ? LIMIT 1`,
    [ticketUid],
  );
  return rows[0] ? mapTicketRow(rows[0]) : null;
}

export async function getTicketMessages(ticketUid: string) {
  return query<{
    id: number;
    author_type: string;
    author_name: string;
    body: string;
    created_at: string;
  }>(
    `SELECT id, author_type, author_name, body, created_at
     FROM support_ticket_messages
     WHERE ticket_uid = ?
     ORDER BY created_at ASC`,
    [ticketUid],
  );
}
