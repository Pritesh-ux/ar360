import { query } from "@/lib/db";
import { hasClientManagementAccess } from "@/lib/billing/addons";

export type AdminClientWorkspaceProduct = {
  id: string;
  title: string;
  status: string;
};

export type AdminClientWorkspaceRow = {
  client_uid: string;
  name: string;
  email: string | null;
  company_name: string | null;
  status: string;
  created_at: string;
  products: AdminClientWorkspaceProduct[];
  qr_count: number;
  domain_count: number;
};

export type AdminClientWorkspacesSummary = {
  addonActive: boolean;
  clientCount: number;
  assignedProductCount: number;
  clients: AdminClientWorkspaceRow[];
  /** product id → client display name (for Products tab) */
  productClientLabel: Record<string, string>;
};

export async function getAdminClientWorkspacesSummary(
  customerUid: string,
): Promise<AdminClientWorkspacesSummary> {
  const addonActive = await hasClientManagementAccess(customerUid).catch(() => false);

  const clients = await query<{
    client_uid: string;
    name: string;
    email: string | null;
    company_name: string | null;
    status: string;
    created_at: string;
  }>(
    `SELECT client_uid, name, email, company_name, status, created_at
       FROM clients
      WHERE customer_uid = ?
      ORDER BY created_at DESC`,
    [customerUid],
  ).catch(() => []);

  if (clients.length === 0) {
    return {
      addonActive,
      clientCount: 0,
      assignedProductCount: 0,
      clients: [],
      productClientLabel: {},
    };
  }

  const clientUids = clients.map((c) => c.client_uid);
  const placeholders = clientUids.map(() => "?").join(",");

  const resources = await query<{
    client_uid: string;
    resource_type: string;
    resource_id: string;
  }>(
    `SELECT client_uid, resource_type, resource_id
       FROM client_resources
      WHERE client_uid IN (${placeholders})`,
    clientUids,
  ).catch(() => []);

  const productIds = [
    ...new Set(
      resources.filter((r) => r.resource_type === "product").map((r) => r.resource_id),
    ),
  ];

  const productRows =
    productIds.length > 0
      ? await query<{ id: string; title: string; status: string }>(
          `SELECT id, title, status FROM products
            WHERE customer_uid = ? AND deleted_at IS NULL
              AND id IN (${productIds.map(() => "?").join(",")})`,
          [customerUid, ...productIds],
        ).catch(() => [])
      : [];

  const productById = new Map(productRows.map((p) => [p.id, p]));
  const productClientLabel: Record<string, string> = {};

  const clientRows: AdminClientWorkspaceRow[] = clients.map((client) => {
    const mine = resources.filter((r) => r.client_uid === client.client_uid);
    const products: AdminClientWorkspaceProduct[] = [];
    for (const r of mine) {
      if (r.resource_type !== "product") continue;
      const p = productById.get(r.resource_id);
      if (p) {
        products.push({ id: p.id, title: p.title || "Untitled", status: p.status });
        productClientLabel[p.id] = client.name;
      }
    }
    return {
      client_uid: client.client_uid,
      name: client.name,
      email: client.email,
      company_name: client.company_name,
      status: client.status,
      created_at: client.created_at,
      products,
      qr_count: mine.filter((r) => r.resource_type === "qr_code").length,
      domain_count: mine.filter((r) => r.resource_type === "domain").length,
    };
  });

  const assignedProductCount = Object.keys(productClientLabel).length;

  return {
    addonActive,
    clientCount: clients.length,
    assignedProductCount,
    clients: clientRows,
    productClientLabel,
  };
}
