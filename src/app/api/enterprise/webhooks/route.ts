import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureAppSchema } from "@/lib/db";
import { requirePermission, rbacErrorResponse } from "@/lib/enterprise/rbac";
import {
  createWebhook,
  listWebhooks,
  deleteWebhook,
  toggleWebhook,
  listDeliveries,
  retryDelivery,
  type WebhookEvent,
} from "@/lib/enterprise/webhooks.service";
import { writeAuditLog } from "@/lib/enterprise/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_EVENTS: WebhookEvent[] = [
  "product.created", "product.updated", "product.published", "product.deleted",
  "viewer.opened", "ar.launched", "asset.uploaded", "analytics.daily_ready",
];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const workspaceUid = p.get("workspaceUid") ?? "";
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "webhooks.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const webhookUid = p.get("webhookUid");
  if (webhookUid) {
    const deliveries = await listDeliveries(webhookUid, workspaceUid);
    return NextResponse.json({ deliveries });
  }

  const webhooks = await listWebhooks(workspaceUid);
  return NextResponse.json({ webhooks });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    workspaceUid?: string;
    name?: string;
    url?: string;
    events?: string[];
  };
  const { workspaceUid = "", name = "", url = "", events = [] } = body;
  if (!workspaceUid || !name || !url) return NextResponse.json({ error: "workspaceUid, name, url required." }, { status: 400 });

  const validEvents = events.filter((e) => VALID_EVENTS.includes(e as WebhookEvent)) as WebhookEvent[];
  if (!validEvents.length) return NextResponse.json({ error: "At least one valid event required." }, { status: 400 });

  try { new URL(url); } catch { return NextResponse.json({ error: "Invalid URL." }, { status: 400 }); }

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "webhooks.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  const { webhook, secret } = await createWebhook({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    name,
    url,
    events: validEvents,
  });

  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "webhook.created",
    resourceType: "webhook",
    resourceId: webhook.webhook_uid,
    resourceLabel: name,
  });

  return NextResponse.json({ webhook, secret }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { workspaceUid?: string; webhookUid?: string };
  const { workspaceUid = "", webhookUid = "" } = body;
  if (!workspaceUid || !webhookUid) return NextResponse.json({ error: "workspaceUid and webhookUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "webhooks.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  await deleteWebhook(webhookUid, workspaceUid);
  await writeAuditLog({
    workspaceUid,
    customerUid: user.customerUid ?? "",
    userId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "webhook.deleted",
    resourceType: "webhook",
    resourceId: webhookUid,
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    workspaceUid?: string;
    webhookUid?: string;
    action?: "enable" | "disable" | "retry";
    deliveryId?: number;
  };
  const { workspaceUid = "", webhookUid = "", action, deliveryId } = body;
  if (!workspaceUid) return NextResponse.json({ error: "workspaceUid required." }, { status: 400 });

  await ensureAppSchema();
  try {
    await requirePermission(user.id, workspaceUid, "webhooks.manage");
  } catch (e) {
    return rbacErrorResponse(e);
  }

  if (action === "retry" && deliveryId) {
    await retryDelivery(deliveryId, workspaceUid);
    return NextResponse.json({ success: true });
  }

  if ((action === "enable" || action === "disable") && webhookUid) {
    await toggleWebhook(webhookUid, workspaceUid, action === "enable" ? "active" : "disabled");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
