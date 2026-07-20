import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { hasClientAddon } from "@/lib/billing/addons";
import { ensurePermanentProductQr } from "@/lib/growth/qr.service.impl";

export const runtime = "nodejs";

type ResourceType = "product" | "qr_code" | "domain";

type LinkedQrRow = {
  id: number;
  qr_uid: string;
  name: string;
  status: string;
  scans_count: number;
  created_at: string;
  product_id?: string;
  product_title?: string | null;
};

async function fetchClientLinkedQrCodes(
  customerUid: string,
  qrResourceIds: string[],
  linkedProductIds: string[],
): Promise<LinkedQrRow[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [customerUid];

  if (qrResourceIds.length > 0) {
    const ph = qrResourceIds.map(() => "?").join(",");
    clauses.push(`(q.qr_uid IN (${ph}) OR q.public_id IN (${ph}))`);
    params.push(...qrResourceIds, ...qrResourceIds);
  }
  if (linkedProductIds.length > 0) {
    clauses.push(`q.product_id IN (${linkedProductIds.map(() => "?").join(",")})`);
    params.push(...linkedProductIds);
  }
  if (clauses.length === 0) return [];

  const rows = await query<LinkedQrRow>(
    `SELECT q.id, COALESCE(q.qr_uid, q.public_id) AS qr_uid, q.name, q.status,
            q.scans AS scans_count, q.created_at, q.product_id, p.title AS product_title
       FROM product_qr_codes q
       LEFT JOIN products p ON p.id = q.product_id AND p.customer_uid = q.customer_uid
      WHERE q.customer_uid = ?
        AND q.deleted_at IS NULL
        AND (${clauses.join(" OR ")})`,
    params,
  );

  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = String(row.qr_uid || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function syncProductQrToClient(
  clientUid: string,
  customerUid: string,
  productId: string,
  origin: string,
  userId: number,
) {
  const prod = await query<{ public_id: string | null }>(
    `SELECT public_id FROM products
      WHERE id = ? AND customer_uid = ? AND deleted_at IS NULL
      LIMIT 1`,
    [productId, customerUid],
  );
  const publicId = prod[0]?.public_id?.trim() || productId;

  await ensurePermanentProductQr({
    customerUid,
    userId,
    productId,
    publicId,
    origin,
  }).catch((err) => console.error("syncProductQrToClient ensure QR:", err));

  const qrs = await query<{ qr_uid: string | null; public_id: string }>(
    `SELECT qr_uid, public_id FROM product_qr_codes
      WHERE customer_uid = ? AND product_id = ? AND deleted_at IS NULL`,
    [customerUid, productId],
  );

  for (const qr of qrs) {
    const id = String(qr.qr_uid || qr.public_id || "").trim();
    if (!id) continue;
    await query(
      `DELETE FROM client_resources
        WHERE resource_type = 'qr_code' AND resource_id = ?`,
      [id],
    );
    await query(
      `INSERT IGNORE INTO client_resources (client_uid, resource_type, resource_id)
       VALUES (?, 'qr_code', ?)`,
      [clientUid, id],
    );
  }
}

async function unlinkProductQrsFromClient(
  clientUid: string,
  customerUid: string,
  productId: string,
) {
  const qrs = await query<{ qr_uid: string | null; public_id: string }>(
    `SELECT qr_uid, public_id FROM product_qr_codes
      WHERE customer_uid = ? AND product_id = ? AND deleted_at IS NULL`,
    [customerUid, productId],
  );
  for (const qr of qrs) {
    const id = String(qr.qr_uid || qr.public_id || "").trim();
    if (!id) continue;
    await query(
      `DELETE FROM client_resources
        WHERE client_uid = ? AND resource_type = 'qr_code' AND resource_id = ?`,
      [clientUid, id],
    );
  }
}

async function requireClientAccess(customerUid: string) {
  const active = await hasClientAddon(customerUid);
  if (!active) {
    return NextResponse.json(
      { error: "Client Management module is not active." },
      { status: 403 },
    );
  }
  return null;
}

async function assertClientOwned(clientUid: string, customerUid: string) {
  const rows = await query<{ client_uid: string }>(
    "SELECT client_uid FROM clients WHERE client_uid = ? AND customer_uid = ? LIMIT 1",
    [clientUid, customerUid],
  );
  return Boolean(rows[0]);
}

async function listLinkable(
  customerUid: string,
  clientUid: string,
  type: ResourceType,
) {
  const linked = await query<{ resource_id: string }>(
    `SELECT resource_id FROM client_resources
      WHERE client_uid = ? AND resource_type = ?`,
    [clientUid, type],
  );
  const linkedIds = new Set(linked.map((r) => r.resource_id));

  if (type === "product") {
    const rows = await query<{ id: string; title: string; status: string; created_at: string }>(
      `SELECT id, title, status, created_at
         FROM products
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM client_resources cr
            WHERE cr.resource_type = 'product' AND cr.resource_id = products.id
          )
        ORDER BY updated_at DESC
        LIMIT 200`,
      [customerUid],
    );
    return rows
      .filter((row) => !linkedIds.has(row.id))
      .map((row) => ({
        id: row.id,
        productUid: row.id,
        product_uid: row.id,
        name: row.title || "Untitled",
        title: row.title || "Untitled",
        status: row.status,
        created_at: row.created_at,
      }));
  }

  if (type === "qr_code") {
    const linkedProducts = await query<{ resource_id: string }>(
      `SELECT resource_id FROM client_resources
        WHERE client_uid = ? AND resource_type = 'product'`,
      [clientUid],
    );
    const assignedProductIds = new Set(linkedProducts.map((r) => r.resource_id));

    const rows = await query<{
      qr_uid: string | null;
      public_id: string;
      product_id: string;
      name: string;
      scans: number;
      created_at: string;
      status: string;
    }>(
      `SELECT qr_uid, public_id, product_id, name, scans, created_at, status
         FROM product_qr_codes
        WHERE customer_uid = ? AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 200`,
      [customerUid],
    );
    return rows
      .map((row) => {
        const id = row.qr_uid || row.public_id;
        return {
          id,
          qrUid: id,
          qr_uid: id,
          name: row.name || "QR Code",
          scans: row.scans,
          scans_count: row.scans,
          status: row.status,
          created_at: row.created_at,
          product_id: row.product_id,
        };
      })
      .filter(
        (row) =>
          row.id &&
          !linkedIds.has(row.id) &&
          !assignedProductIds.has(String(row.product_id || "")),
      );
  }

  const rows = await query<{
    domain: string;
    status: string;
    ssl_status: string;
    created_at: string;
  }>(
    `SELECT domain, status, ssl_status, created_at
       FROM custom_domains
      WHERE customer_uid = ?
      ORDER BY created_at DESC
      LIMIT 200`,
    [customerUid],
  );
  return rows
    .filter((row) => !linkedIds.has(row.domain))
    .map((row) => ({
      id: row.domain,
      domain: row.domain,
      name: row.domain,
      status: row.status,
      ssl_status: row.ssl_status,
      created_at: row.created_at,
    }));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    const gated = await requireClientAccess(customerUid);
    if (gated) return gated;

    const { id: clientUid } = await params;
    const linkable = new URL(req.url).searchParams.get("linkable");

    if (linkable === "product" || linkable === "qr_code" || linkable === "domain" || linkable === "qr") {
      const owned = await assertClientOwned(clientUid, customerUid);
      if (!owned) return NextResponse.json({ error: "Client not found." }, { status: 404 });
      const type: ResourceType =
        linkable === "qr" || linkable === "qr_code" ? "qr_code" : (linkable as ResourceType);
      const items = await listLinkable(customerUid, clientUid, type);
      return NextResponse.json({ success: true, items });
    }

    const clients = await query<{
      id: number;
      client_uid: string;
      customer_uid: string;
      name: string;
      email: string | null;
      phone: string | null;
      company_name: string | null;
      status: string;
      tags: unknown;
      created_at: string;
    }>("SELECT * FROM clients WHERE client_uid = ? AND customer_uid = ? LIMIT 1", [
      clientUid,
      customerUid,
    ]);

    const client = clients[0];
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const resources = await query<{ resource_type: string; resource_id: string }>(
      "SELECT resource_type, resource_id FROM client_resources WHERE client_uid = ?",
      [clientUid],
    );

    const productIds = resources.filter((r) => r.resource_type === "product").map((r) => r.resource_id);

    const origin = new URL(req.url).origin;
    const userId = Number(user.id) || 0;
    for (const productId of productIds) {
      await syncProductQrToClient(clientUid, customerUid, productId, origin, userId);
    }

    let linkedProducts: Array<{
      product_uid: string;
      name: string;
      status: string;
      created_at: string;
      model_url: string | null;
    }> = [];
    if (productIds.length > 0) {
      linkedProducts = await query(
        `SELECT id AS product_uid, title AS name, category, status, created_at, model_url,
                poster, thumbnail_url, file_name, views, product_folder
           FROM products
          WHERE customer_uid = ?
            AND deleted_at IS NULL
            AND id IN (${productIds.map(() => "?").join(",")})`,
        [customerUid, ...productIds],
      );
    }

    const qrIds = resources.filter((r) => r.resource_type === "qr_code").map((r) => r.resource_id);
    const linkedQrCodes = await fetchClientLinkedQrCodes(customerUid, qrIds, productIds);

    const domainIds = resources.filter((r) => r.resource_type === "domain").map((r) => r.resource_id);
    let linkedDomains: Array<{
      domain: string;
      status: string;
      ssl_status: string;
      created_at: string;
    }> = [];
    if (domainIds.length > 0) {
      linkedDomains = await query(
        `SELECT domain, status, ssl_status, created_at
           FROM custom_domains
          WHERE customer_uid = ?
            AND domain IN (${domainIds.map(() => "?").join(",")})`,
        [customerUid, ...domainIds],
      );
    }

    const activities = await query(
      `SELECT action, resource_type, resource_id, created_at
         FROM audit_logs
        WHERE customer_uid = ? AND resource_id = ?
        ORDER BY created_at DESC LIMIT 20`,
      [customerUid, clientUid],
    ).catch(() => []);

    return NextResponse.json({
      success: true,
      client,
      products: linkedProducts,
      qrCodes: linkedQrCodes,
      domains: linkedDomains,
      activities,
    });
  } catch (error) {
    console.error("GET /api/clients/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch client details." }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    const gated = await requireClientAccess(customerUid);
    if (gated) return gated;

    const { id: clientUid } = await params;
    const body = await req.json();

    const name = body.name !== undefined ? String(body.name || "").trim() : undefined;
    const email = body.email !== undefined ? String(body.email || "").trim() || null : undefined;
    const phone = body.phone !== undefined ? String(body.phone || "").trim() || null : undefined;
    const companyName =
      body.companyName !== undefined ? String(body.companyName || "").trim() || null : undefined;
    const status = body.status !== undefined ? String(body.status || "active").trim() : undefined;
    const tags = body.tags !== undefined ? (body.tags ? JSON.stringify(body.tags) : null) : undefined;

    const updates: string[] = [];
    const values: Array<string | null> = [];

    if (name !== undefined) {
      if (!name) return NextResponse.json({ error: "Client Name is required." }, { status: 400 });
      updates.push("name = ?");
      values.push(name);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      values.push(phone);
    }
    if (companyName !== undefined) {
      updates.push("company_name = ?");
      values.push(companyName);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);
    }
    if (tags !== undefined) {
      updates.push("tags = ?");
      values.push(tags);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    values.push(clientUid, customerUid);
    await query(
      `UPDATE clients SET ${updates.join(", ")}, updated_at = NOW()
       WHERE client_uid = ? AND customer_uid = ?`,
      values,
    );

    await query(
      `INSERT INTO audit_logs (customer_uid, user_id, actor_name, actor_email, action, resource_type, resource_id)
       VALUES (?, ?, ?, ?, 'update', 'client', ?)`,
      [customerUid, user.id || null, user.name || "", user.email || "", clientUid],
    ).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/clients/[id] error:", error);
    return NextResponse.json({ error: "Failed to update client." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    const gated = await requireClientAccess(customerUid);
    if (gated) return gated;

    const { id: clientUid } = await params;

    await query("DELETE FROM clients WHERE client_uid = ? AND customer_uid = ?", [
      clientUid,
      customerUid,
    ]);
    await query("DELETE FROM client_resources WHERE client_uid = ?", [clientUid]);

    await query(
      `INSERT INTO audit_logs (customer_uid, user_id, actor_name, actor_email, action, resource_type, resource_id)
       VALUES (?, ?, ?, ?, 'delete', 'client', ?)`,
      [customerUid, user.id || null, user.name || "", user.email || "", clientUid],
    ).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/clients/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete client." }, { status: 500 });
  }
}

async function assertResourceOwned(
  customerUid: string,
  resourceType: ResourceType,
  resourceId: string,
) {
  if (resourceType === "product") {
    const rows = await query<{ id: string }>(
      `SELECT id FROM products
        WHERE id = ? AND customer_uid = ? AND deleted_at IS NULL LIMIT 1`,
      [resourceId, customerUid],
    );
    return Boolean(rows[0]);
  }
  if (resourceType === "qr_code") {
    const rows = await query<{ id: number }>(
      `SELECT id FROM product_qr_codes
        WHERE customer_uid = ? AND deleted_at IS NULL
          AND (qr_uid = ? OR public_id = ?)
        LIMIT 1`,
      [customerUid, resourceId, resourceId],
    );
    return Boolean(rows[0]);
  }
  const rows = await query<{ domain: string }>(
    `SELECT domain FROM custom_domains
      WHERE domain = ? AND customer_uid = ? LIMIT 1`,
    [resourceId, customerUid],
  );
  return Boolean(rows[0]);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
    const customerUid = user.customerUid;
    if (!customerUid) {
      return NextResponse.json({ error: "Customer context missing." }, { status: 400 });
    }

    const gated = await requireClientAccess(customerUid);
    if (gated) return gated;

    const { id: clientUid } = await params;
    const owned = await assertClientOwned(clientUid, customerUid);
    if (!owned) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const body = await req.json();
    const action = String(body.action || "link").trim();
    let resourceType = String(body.resourceType || "").trim();
    if (resourceType === "qr") resourceType = "qr_code";
    const resourceId = String(body.resourceId || "").trim();

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: "Resource properties missing." }, { status: 400 });
    }
    if (resourceType !== "product" && resourceType !== "qr_code" && resourceType !== "domain") {
      return NextResponse.json({ error: "Invalid resource type." }, { status: 400 });
    }

    if (action === "link") {
      const resourceOwned = await assertResourceOwned(
        customerUid,
        resourceType as ResourceType,
        resourceId,
      );
      if (!resourceOwned) {
        return NextResponse.json(
          { error: "Resource not found in your account." },
          { status: 404 },
        );
      }
      if (resourceType === "product") {
        await query(
          `DELETE FROM client_resources
            WHERE resource_type = 'product' AND resource_id = ?`,
          [resourceId],
        );
      }
      await query(
        `INSERT IGNORE INTO client_resources (client_uid, resource_type, resource_id)
         VALUES (?, ?, ?)`,
        [clientUid, resourceType, resourceId],
      );
      if (resourceType === "product") {
        const origin = new URL(req.url).origin;
        const userId = Number(user.id) || 0;
        await syncProductQrToClient(clientUid, customerUid, resourceId, origin, userId);
      }
    } else {
      if (resourceType === "product") {
        await unlinkProductQrsFromClient(clientUid, customerUid, resourceId);
      }
      await query(
        `DELETE FROM client_resources
          WHERE client_uid = ? AND resource_type = ? AND resource_id = ?`,
        [clientUid, resourceType, resourceId],
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/clients/[id] resource mapping error:", error);
    return NextResponse.json({ error: "Failed to update resource mapping." }, { status: 500 });
  }
}
