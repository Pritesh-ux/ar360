import type { Connection } from "mysql2/promise";
import crypto from "crypto";
import { query } from "@/lib/db";
import { isDemoSeedEnabled } from "@/lib/seed/config";

export const DEMO_TICKET_ASSIGNEES = [
  "Jane Cooper",
  "Wade Warren",
  "Esther Howard",
  "Robert Fox",
  "Kristin Watson",
  "Unassigned",
];

/** @deprecated Use DEMO_TICKET_ASSIGNEES */
export const ASSIGNEES = DEMO_TICKET_ASSIGNEES;

type SeedTicket = {
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  category: "technical" | "billing" | "account" | "feature" | "other";
  priority: "low" | "medium" | "high";
  status: "open" | "pending" | "resolved" | "closed";
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
};

export const DEMO_SUPPORT_TICKETS: SeedTicket[] = [
  { ticketNumber: "TK-2025-00128", customerName: "Rahul Sharma", customerEmail: "rahul@example.com", subject: "Unable to upload 3D model", description: "GLB upload fails at 85% with timeout error.", category: "technical", priority: "high", status: "open", assignedTo: "Jane Cooper", createdAt: "2025-05-18 09:12:00", updatedAt: "2025-05-18 11:45:00" },
  { ticketNumber: "TK-2025-00127", customerName: "Ananya Verma", customerEmail: "ananya@example.com", subject: "Invoice not received for May", description: "Paid subscription renewal but GST invoice missing.", category: "billing", priority: "medium", status: "pending", assignedTo: "Wade Warren", createdAt: "2025-05-17 14:20:00", updatedAt: "2025-05-18 08:30:00" },
  { ticketNumber: "TK-2025-00126", customerName: "Vikram Patel", customerEmail: "vikram@example.com", subject: "AR preview not loading on iOS", description: "USDZ model shows blank screen on Safari iPhone 15.", category: "technical", priority: "high", status: "open", assignedTo: "Esther Howard", createdAt: "2025-05-17 10:05:00", updatedAt: "2025-05-17 16:22:00" },
  { ticketNumber: "TK-2025-00125", customerName: "Priya Nair", customerEmail: "priya@example.com", subject: "Reset team member password", description: "Need admin to reset access for designer account.", category: "account", priority: "low", status: "resolved", assignedTo: "Robert Fox", createdAt: "2025-05-16 08:40:00", updatedAt: "2025-05-17 09:15:00" },
  { ticketNumber: "TK-2025-00124", customerName: "Arjun Mehta", customerEmail: "arjun@example.com", subject: "Request bulk product import", description: "Looking for CSV import for 200 SKUs.", category: "feature", priority: "medium", status: "open", assignedTo: "Kristin Watson", createdAt: "2025-05-16 11:18:00", updatedAt: "2025-05-18 07:50:00" },
  { ticketNumber: "TK-2025-00123", customerName: "Sneha Reddy", customerEmail: "sneha@example.com", subject: "Double charged on renewal", description: "Credit card charged twice for annual plan.", category: "billing", priority: "high", status: "pending", assignedTo: "Wade Warren", createdAt: "2025-05-15 16:55:00", updatedAt: "2025-05-16 10:10:00" },
  { ticketNumber: "TK-2025-00122", customerName: "Karan Singh", customerEmail: "karan@example.com", subject: "Embed viewer shows 404", description: "Embedded iframe returns not found on client site.", category: "technical", priority: "medium", status: "resolved", assignedTo: "Jane Cooper", createdAt: "2025-05-15 09:30:00", updatedAt: "2025-05-16 14:00:00" },
  { ticketNumber: "TK-2025-00121", customerName: "Meera Iyer", customerEmail: "meera@example.com", subject: "Upgrade to Enterprise plan", description: "Need quote for 250 products and custom branding.", category: "billing", priority: "medium", status: "closed", assignedTo: "Robert Fox", createdAt: "2025-05-14 13:45:00", updatedAt: "2025-05-15 17:20:00" },
  { ticketNumber: "TK-2025-00120", customerName: "Dev Kapoor", customerEmail: "dev@example.com", subject: "Texture maps not applying", description: "PBR materials revert after save on product editor.", category: "technical", priority: "high", status: "open", assignedTo: "Esther Howard", createdAt: "2025-05-14 08:22:00", updatedAt: "2025-05-18 06:40:00" },
  { ticketNumber: "TK-2025-00119", customerName: "Lakshmi Rao", customerEmail: "lakshmi@example.com", subject: "Cannot login after 2FA setup", description: "Authenticator codes rejected since yesterday.", category: "account", priority: "high", status: "pending", assignedTo: "Kristin Watson", createdAt: "2025-05-13 19:10:00", updatedAt: "2025-05-14 11:05:00" },
  { ticketNumber: "TK-2025-00118", customerName: "Rohan Das", customerEmail: "rohan@example.com", subject: "QR code analytics mismatch", description: "Scan count lower than expected in dashboard.", category: "technical", priority: "low", status: "resolved", assignedTo: "Jane Cooper", createdAt: "2025-05-13 12:00:00", updatedAt: "2025-05-14 09:30:00" },
  { ticketNumber: "TK-2025-00117", customerName: "Isha Gupta", customerEmail: "isha@example.com", subject: "Cancel subscription refund", description: "Cancelled within 7 days, requesting pro-rated refund.", category: "billing", priority: "medium", status: "closed", assignedTo: "Wade Warren", createdAt: "2025-05-12 15:35:00", updatedAt: "2025-05-13 10:00:00" },
  { ticketNumber: "TK-2025-00116", customerName: "Amit Joshi", customerEmail: "amit@example.com", subject: "White-label viewer branding", description: "How to remove AR360 watermark on Professional plan?", category: "feature", priority: "low", status: "closed", assignedTo: "Robert Fox", createdAt: "2025-05-12 09:18:00", updatedAt: "2025-05-12 16:45:00" },
  { ticketNumber: "TK-2025-00115", customerName: "Neha Kulkarni", customerEmail: "neha@example.com", subject: "Storage limit reached unexpectedly", description: "Dashboard shows 5GB used but only 2 products uploaded.", category: "technical", priority: "medium", status: "open", assignedTo: "Unassigned", createdAt: "2025-05-11 17:50:00", updatedAt: "2025-05-11 17:50:00" },
  { ticketNumber: "TK-2025-00114", customerName: "Sanjay Malhotra", customerEmail: "sanjay@example.com", subject: "API access for product sync", description: "Need REST API docs for ERP integration.", category: "feature", priority: "medium", status: "pending", assignedTo: "Kristin Watson", createdAt: "2025-05-11 10:25:00", updatedAt: "2025-05-12 08:15:00" },
  { ticketNumber: "TK-2025-00113", customerName: "Pooja Shah", customerEmail: "pooja@example.com", subject: "Account suspended without notice", description: "Login blocked, need urgent restoration.", category: "account", priority: "high", status: "resolved", assignedTo: "Esther Howard", createdAt: "2025-05-10 07:40:00", updatedAt: "2025-05-10 12:30:00" },
  { ticketNumber: "TK-2025-00112", customerName: "Harish Pillai", customerEmail: "harish@example.com", subject: "Draco compression support", description: "Compressed GLB fails to load in viewer.", category: "technical", priority: "medium", status: "closed", assignedTo: "Jane Cooper", createdAt: "2025-05-09 14:12:00", updatedAt: "2025-05-11 09:00:00" },
  { ticketNumber: "TK-2025-00111", customerName: "Divya Menon", customerEmail: "divya@example.com", subject: "Payment method update failed", description: "Razorpay card update returns generic error.", category: "billing", priority: "high", status: "open", assignedTo: "Wade Warren", createdAt: "2025-05-09 11:05:00", updatedAt: "2025-05-18 05:20:00" },
  { ticketNumber: "TK-2025-00110", customerName: "Manish Agarwal", customerEmail: "manish@example.com", subject: "Export analytics to CSV", description: "Feature request for monthly viewer report export.", category: "feature", priority: "low", status: "closed", assignedTo: "Robert Fox", createdAt: "2025-05-08 16:30:00", updatedAt: "2025-05-09 11:00:00" },
  { ticketNumber: "TK-2025-00109", customerName: "Tanvi Desai", customerEmail: "tanvi@example.com", subject: "Object capture quality issue", description: "Photogrammetry output has missing geometry.", category: "technical", priority: "medium", status: "pending", assignedTo: "Esther Howard", createdAt: "2025-05-08 09:45:00", updatedAt: "2025-05-17 13:10:00" },
  { ticketNumber: "TK-2025-00108", customerName: "Gaurav Bhatia", customerEmail: "gaurav@example.com", subject: "Add second admin user", description: "Need to invite colleague with billing access only.", category: "account", priority: "low", status: "resolved", assignedTo: "Kristin Watson", createdAt: "2025-05-07 13:20:00", updatedAt: "2025-05-08 08:50:00" },
  { ticketNumber: "TK-2025-00107", customerName: "Shreya Banerjee", customerEmail: "shreya@example.com", subject: "Coupon code not applying", description: "WELCOME20 shows invalid at checkout.", category: "billing", priority: "medium", status: "closed", assignedTo: "Wade Warren", createdAt: "2025-05-07 10:00:00", updatedAt: "2025-05-07 15:30:00" },
  { ticketNumber: "TK-2025-00106", customerName: "Nikhil Choudhury", customerEmail: "nikhil@example.com", subject: "Viewer loads slowly on mobile", description: "3G networks take 30+ seconds to show model.", category: "technical", priority: "low", status: "open", assignedTo: "Jane Cooper", createdAt: "2025-05-06 18:15:00", updatedAt: "2025-05-16 07:00:00" },
  { ticketNumber: "TK-2025-00105", customerName: "Aditi Saxena", customerEmail: "aditi@example.com", subject: "Wrong plan activated", description: "Paid for Professional but account shows Basic.", category: "billing", priority: "high", status: "resolved", assignedTo: "Wade Warren", createdAt: "2025-05-06 12:40:00", updatedAt: "2025-05-07 09:20:00" },
  { ticketNumber: "TK-2025-00104", customerName: "Varun Khanna", customerEmail: "varun@example.com", subject: "Custom domain for viewer links", description: "Enterprise feature inquiry for branded URLs.", category: "feature", priority: "medium", status: "closed", assignedTo: "Robert Fox", createdAt: "2025-05-05 15:55:00", updatedAt: "2025-05-06 10:10:00" },
  { ticketNumber: "TK-2025-00103", customerName: "Kavya Srinivasan", customerEmail: "kavya@example.com", subject: "Email notifications not received", description: "No alerts for new viewer analytics.", category: "other", priority: "low", status: "pending", assignedTo: "Unassigned", createdAt: "2025-05-05 08:30:00", updatedAt: "2025-05-05 14:00:00" },
  { ticketNumber: "TK-2025-00102", customerName: "Ritesh Oberoi", customerEmail: "ritesh@example.com", subject: "Product deleted accidentally", description: "Need recovery of archived sofa model.", category: "account", priority: "high", status: "open", assignedTo: "Esther Howard", createdAt: "2025-05-04 17:25:00", updatedAt: "2025-05-18 04:15:00" },
  { ticketNumber: "TK-2025-00101", customerName: "Nandini Roy", customerEmail: "nandini@example.com", subject: "GSTIN update on invoices", description: "Company GST number changed, update billing profile.", category: "billing", priority: "medium", status: "closed", assignedTo: "Wade Warren", createdAt: "2025-05-04 11:10:00", updatedAt: "2025-05-05 09:45:00" },
  { ticketNumber: "TK-2025-00100", customerName: "Abhishek Tiwari", customerEmail: "abhishek@example.com", subject: "Hotspot editor bug", description: "Hotspots disappear after publishing product.", category: "technical", priority: "high", status: "resolved", assignedTo: "Jane Cooper", createdAt: "2025-05-03 14:50:00", updatedAt: "2025-05-04 16:30:00" },
];

function ticketUid() {
  return `tkt_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

type ExecFn = Pick<Connection, "execute">;

async function countTickets(exec: ExecFn) {
  const [rows]: any = await exec.execute("SELECT COUNT(*) AS count FROM support_tickets");
  return Number(rows[0]?.count || 0);
}

async function loadCustomers(exec: ExecFn) {
  const [rows]: any = await exec.execute(
    "SELECT customer_uid, contact_name, email FROM customers ORDER BY created_at DESC LIMIT 30",
  );
  return rows as { customer_uid: string; contact_name: string; email: string }[];
}

export async function seedDemoSupportTickets(exec?: ExecFn) {
  if (!isDemoSeedEnabled()) {
    console.log("Skipping demo support ticket seed (SEED_DEMO_DATA disabled).");
    return { inserted: 0, skipped: true };
  }

  if (exec) {
    const existing = await countTickets(exec);
    if (existing > 0) {
      console.log(`Skipping demo support ticket seed (${existing} tickets already exist).`);
      return { inserted: 0, skipped: true };
    }

    const customers = await loadCustomers(exec);
    for (let index = 0; index < DEMO_SUPPORT_TICKETS.length; index++) {
      const ticket = DEMO_SUPPORT_TICKETS[index];
      const customer = customers[index % Math.max(customers.length, 1)];
      await exec.execute(
        `INSERT INTO support_tickets (
          ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
          subject, description, category, priority, status, assigned_to, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ticketUid(),
          ticket.ticketNumber,
          customer?.customer_uid || "",
          customer?.contact_name || ticket.customerName,
          customer?.email || ticket.customerEmail,
          ticket.subject,
          ticket.description,
          ticket.category,
          ticket.priority,
          ticket.status,
          ticket.assignedTo,
          ticket.createdAt,
          ticket.updatedAt,
        ],
      );
    }
    console.log(`Seeded ${DEMO_SUPPORT_TICKETS.length} demo support tickets.`);
    return { inserted: DEMO_SUPPORT_TICKETS.length, skipped: false };
  }

  const existing = await query<{ count: number }>("SELECT COUNT(*) AS count FROM support_tickets");
  if (Number(existing[0]?.count || 0) > 0) {
    return { inserted: 0, skipped: true };
  }

  const customers = await query<{ customer_uid: string; contact_name: string; email: string }>(
    "SELECT customer_uid, contact_name, email FROM customers ORDER BY created_at DESC LIMIT 30",
  ).catch(() => []);

  for (let index = 0; index < DEMO_SUPPORT_TICKETS.length; index++) {
    const ticket = DEMO_SUPPORT_TICKETS[index];
    const customer = customers[index % Math.max(customers.length, 1)];
    await query(
      `INSERT INTO support_tickets (
        ticket_uid, ticket_number, customer_uid, customer_name, customer_email,
        subject, description, category, priority, status, assigned_to, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketUid(),
        ticket.ticketNumber,
        customer?.customer_uid || "",
        customer?.contact_name || ticket.customerName,
        customer?.email || ticket.customerEmail,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.assignedTo,
        ticket.createdAt,
        ticket.updatedAt,
      ],
    );
  }

  return { inserted: DEMO_SUPPORT_TICKETS.length, skipped: false };
}
