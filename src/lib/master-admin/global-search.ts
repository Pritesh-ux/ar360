import { query } from "@/lib/db";

export type SearchResultGroup = "customers" | "products" | "invoices" | "tickets";

export type GlobalSearchResult = {
  id: string;
  group: SearchResultGroup;
  label: string;
  subtitle: string;
  href: string;
  meta?: string;
};

export type GlobalSearchResponse = {
  query: string;
  results: GlobalSearchResult[];
  groups: Record<SearchResultGroup, GlobalSearchResult[]>;
};

const GROUP_LIMIT = 5;

function emptyGroups(): Record<SearchResultGroup, GlobalSearchResult[]> {
  return { customers: [], products: [], invoices: [], tickets: [] };
}

export async function searchMasterAdmin(queryText: string, limitPerGroup = GROUP_LIMIT): Promise<GlobalSearchResponse> {
  const q = queryText.trim();
  const groups = emptyGroups();

  if (q.length < 2) {
    return { query: q, results: [], groups };
  }

  const like = `%${q}%`;
  const cap = Math.min(Math.max(limitPerGroup, 1), 10);

  const [customers, products, invoices, tickets] = await Promise.all([
    query<{
      customer_uid: string;
      contact_name: string;
      email: string;
      company_name: string | null;
    }>(
      `SELECT customer_uid, contact_name, email, company_name
       FROM customers
       WHERE contact_name LIKE ? OR email LIKE ? OR company_name LIKE ? OR customer_uid LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [like, like, like, like, cap],
    ).catch(() => []),

    query<{
      id: string;
      title: string;
      customer_uid: string;
      status: string;
    }>(
      `SELECT p.id, p.title, p.customer_uid, p.status
       FROM products p
       WHERE p.title LIKE ? OR p.id LIKE ? OR p.customer_uid LIKE ?
       ORDER BY p.updated_at DESC
       LIMIT ?`,
      [like, like, like, cap],
    ).catch(() => []),

    query<{
      payment_uid: string;
      invoice: string;
      customer_uid: string;
      contact_name: string;
      email: string;
      total: number;
      status: string;
    }>(
      `SELECT bp.payment_uid, bp.invoice_uid AS invoice, bp.customer_uid,
              c.contact_name, c.email,
              ROUND(COALESCE(bp.amount_paise, 0) / 100) AS total,
              bp.status
       FROM billing_payments bp
       LEFT JOIN customers c ON c.customer_uid = bp.customer_uid
       WHERE bp.payment_uid LIKE ? OR bp.invoice_uid LIKE ? OR c.email LIKE ? OR c.contact_name LIKE ?
       ORDER BY bp.created_at DESC
       LIMIT ?`,
      [like, like, like, like, cap],
    ).catch(() => []),

    query<{
      ticket_uid: string;
      ticket_number: string;
      subject: string;
      customer_name: string;
      status: string;
    }>(
      `SELECT ticket_uid, ticket_number, subject, customer_name, status
       FROM support_tickets
       WHERE ticket_number LIKE ? OR subject LIKE ? OR customer_name LIKE ? OR customer_email LIKE ?
       ORDER BY updated_at DESC
       LIMIT ?`,
      [like, like, like, like, cap],
    ).catch(() => []),
  ]);

  groups.customers = customers.map((row) => ({
    id: row.customer_uid,
    group: "customers" as const,
    label: row.contact_name || row.email,
    subtitle: row.company_name || row.email,
    href: `/master-admin/customers/${row.customer_uid}`,
    meta: row.customer_uid,
  }));

  groups.products = products.map((row) => ({
    id: row.id,
    group: "products" as const,
    label: row.title || row.id,
    subtitle: row.customer_uid,
    href: `/master-admin/products/${row.id}`,
    meta: row.status,
  }));

  groups.invoices = invoices.map((row) => ({
    id: row.payment_uid,
    group: "invoices" as const,
    label: row.invoice || row.payment_uid,
    subtitle: row.contact_name || row.email || row.customer_uid,
    href: `/master-admin/billing`,
    meta: row.status,
  }));

  groups.tickets = tickets.map((row) => ({
    id: row.ticket_uid,
    group: "tickets" as const,
    label: row.subject,
    subtitle: `${row.ticket_number} · ${row.customer_name}`,
    href: `/master-admin/support-tickets`,
    meta: row.status,
  }));

  const results = [...groups.customers, ...groups.products, ...groups.invoices, ...groups.tickets];

  return { query: q, results, groups };
}
