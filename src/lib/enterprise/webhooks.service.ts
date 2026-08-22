import { randomBytes, createHmac } from "crypto";
import { query } from "@/lib/db";
import { assertSafeOutboundUrl } from "@/lib/security/ssrf";

export type WebhookEvent =
  | "product.created" | "product.updated" | "product.published" | "product.deleted"
  | "viewer.opened" | "ar.launched"
  | "asset.uploaded"
  | "analytics.daily_ready";

export type WebhookRow = {
  id: number;
  webhook_uid: string;
  workspace_uid: string;
  customer_uid: string;
  name: string;
  url: string;
  secret_hash: string;
  events: string; // JSON
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

export type WebhookPublic = Omit<WebhookRow, "secret_hash" | "events"> & {
  events: WebhookEvent[];
};

export type DeliveryRow = {
  id: number;
  webhook_uid: string;
  workspace_uid: string;
  event: string;
  payload: string;
  status: "pending" | "success" | "failed";
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

function generateWebhookUid(): string {
  return `WH_${randomBytes(6).toString("hex").toUpperCase()}`;
}

function hashSecret(secret: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev").update(secret).digest("hex");
}

export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function createWebhook(params: {
  workspaceUid: string;
  customerUid: string;
  name: string;
  url: string;
  events: WebhookEvent[];
}): Promise<{ webhook: WebhookPublic; secret: string }> {
  const safeUrl = await assertSafeOutboundUrl(params.url);
  if (safeUrl.ok === false) {
    throw new Error(safeUrl.error);
  }

  const uid = generateWebhookUid();
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const secretHash = hashSecret(secret);

  await query(
    `INSERT INTO webhooks (webhook_uid, workspace_uid, customer_uid, name, url, secret_hash, events, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [uid, params.workspaceUid, params.customerUid, params.name, safeUrl.href, secretHash, JSON.stringify(params.events)],
  );

  const rows = await query<WebhookRow>(
    "SELECT * FROM webhooks WHERE webhook_uid = ? LIMIT 1",
    [uid],
  );
  const row = rows[0];
  return {
    secret,
    webhook: { ...row, events: JSON.parse(row.events) as WebhookEvent[] },
  };
}

export async function listWebhooks(workspaceUid: string): Promise<WebhookPublic[]> {
  const rows = await query<WebhookRow>(
    "SELECT * FROM webhooks WHERE workspace_uid = ? ORDER BY created_at DESC",
    [workspaceUid],
  );
  return rows.map((r) => ({ ...r, events: JSON.parse(r.events) as WebhookEvent[] }));
}

export async function deleteWebhook(webhookUid: string, workspaceUid: string): Promise<void> {
  await query(
    "DELETE FROM webhooks WHERE webhook_uid = ? AND workspace_uid = ?",
    [webhookUid, workspaceUid],
  );
}

export async function toggleWebhook(
  webhookUid: string,
  workspaceUid: string,
  status: "active" | "disabled",
): Promise<void> {
  await query(
    "UPDATE webhooks SET status = ? WHERE webhook_uid = ? AND workspace_uid = ?",
    [status, webhookUid, workspaceUid],
  );
}

export async function dispatchWebhookEvent(
  workspaceUid: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const hooks = await query<WebhookRow>(
    `SELECT * FROM webhooks WHERE workspace_uid = ? AND status = 'active'`,
    [workspaceUid],
  );

  for (const hook of hooks) {
    const events = JSON.parse(hook.events) as WebhookEvent[];
    if (!events.includes(event)) continue;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    // Insert delivery record
    await query(
      `INSERT INTO webhook_deliveries (webhook_uid, workspace_uid, event, payload, status, attempt_count)
       VALUES (?, ?, ?, ?, 'pending', 0)`,
      [hook.webhook_uid, workspaceUid, event, body],
    ).catch(() => {});

    // Fire async — do not await
    deliverWebhook(hook, body).catch(() => {});
  }
}

async function deliverWebhook(hook: WebhookRow, body: string): Promise<void> {
  const sig = signPayload(hook.secret_hash, body);
  try {
    const safeUrl = await assertSafeOutboundUrl(hook.url);
    if (safeUrl.ok === false) {
      throw new Error(safeUrl.error);
    }

    const res = await fetch(safeUrl.href, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ARStudio-Signature": `sha256=${sig}`,
        "X-ARStudio-Event": "webhook",
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });

    await query(
      `UPDATE webhook_deliveries
       SET status = ?, response_status = ?, attempt_count = attempt_count + 1, delivered_at = NOW()
       WHERE webhook_uid = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [res.ok ? "success" : "failed", res.status, hook.webhook_uid],
    ).catch(() => {});
  } catch {
    await query(
      `UPDATE webhook_deliveries
       SET status = 'failed', attempt_count = attempt_count + 1
       WHERE webhook_uid = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [hook.webhook_uid],
    ).catch(() => {});
  }
}

export async function listDeliveries(webhookUid: string, workspaceUid: string): Promise<DeliveryRow[]> {
  return query<DeliveryRow>(
    `SELECT * FROM webhook_deliveries
     WHERE webhook_uid = ? AND workspace_uid = ?
     ORDER BY created_at DESC LIMIT 100`,
    [webhookUid, workspaceUid],
  );
}

export async function retryDelivery(deliveryId: number, workspaceUid: string): Promise<void> {
  const rows = await query<DeliveryRow & { url: string; secret_hash: string }>(
    `SELECT wd.*, wh.url, wh.secret_hash
     FROM webhook_deliveries wd
     JOIN webhooks wh ON wh.webhook_uid = wd.webhook_uid
     WHERE wd.id = ? AND wd.workspace_uid = ? LIMIT 1`,
    [deliveryId, workspaceUid],
  );
  const d = rows[0];
  if (!d) return;

  await query(
    "UPDATE webhook_deliveries SET status = 'pending' WHERE id = ?",
    [deliveryId],
  );

  deliverWebhook(
    { webhook_uid: d.webhook_uid, url: d.url, secret_hash: d.secret_hash } as WebhookRow,
    d.payload,
  ).catch(() => {});
}
