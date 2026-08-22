import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema } from "@/lib/db";
import {
  deleteAdminNotifications,
  getAdminNotificationsFeed,
  markAdminNotificationsRead,
} from "@/lib/master-admin/notifications";
import {
  validateDeleteNotificationPayload,
  validateReadNotificationPayload,
} from "@/lib/notifications/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guardAdminPermission([
    "analytics.read",
    "customers.read",
    "billing.read",
    "tickets.read",
  ]);
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();

  return NextResponse.json(await getAdminNotificationsFeed(50));
}

export async function PATCH(req: NextRequest) {
  const auth = await guardAdminPermission([
    "analytics.read",
    "customers.read",
    "billing.read",
    "tickets.read",
  ]);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureAppSchema();

  const mutation = validateReadNotificationPayload(await req.json().catch(() => null));
  if (mutation.ok === false) {
    return NextResponse.json({ error: mutation.error }, { status: 400 });
  }
  await markAdminNotificationsRead(mutation.data.ids, mutation.data.markAll);
  const feed = await getAdminNotificationsFeed(50, { sync: false });
  await logAdminAudit(admin, "notification.mark_read", "admin_notification", null);
  return NextResponse.json({ ok: true, ...feed });
}

export async function DELETE(req: NextRequest) {
  const auth = await guardAdminPermission([
    "analytics.read",
    "customers.read",
    "billing.read",
    "tickets.read",
  ]);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureAppSchema();
  const mutation = validateDeleteNotificationPayload(await req.json().catch(() => null));
  if (mutation.ok === false) {
    return NextResponse.json({ error: mutation.error }, { status: 400 });
  }
  await deleteAdminNotifications(mutation.data.ids, mutation.data.clearAll);
  const feed = await getAdminNotificationsFeed(50, { sync: false });
  await logAdminAudit(admin, "notification.delete", "admin_notification", null);
  return NextResponse.json({ ok: true, ...feed });
}
