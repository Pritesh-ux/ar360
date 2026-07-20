import { NextRequest, NextResponse } from "next/server";
import {
  clearCustomerNotifications,
  countUnreadCustomerNotifications,
  deleteCustomerNotifications,
  listCustomerNotifications,
  markCustomerNotificationsRead,
} from "@/lib/user-panel/notifications.service";
import {
  rejectScopedApiUser,
  requireScopedApiUser,
} from "@/lib/user-panel/api-guard";
import {
  validateDeleteNotificationPayload,
  validateReadNotificationPayload,
} from "@/lib/notifications/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const [notifications, unreadCount] = await Promise.all([
    listCustomerNotifications(user.customerUid, 20),
    countUnreadCustomerNotifications(user.customerUid),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const mutation = validateReadNotificationPayload(await req.json().catch(() => null));
  if (mutation.ok === false) {
    return NextResponse.json({ error: mutation.error }, { status: 400 });
  }
  await markCustomerNotificationsRead(
    user.customerUid,
    mutation.data.ids,
    mutation.data.markAll,
  );

  const [notifications, unreadCount] = await Promise.all([
    listCustomerNotifications(user.customerUid, 20),
    countUnreadCustomerNotifications(user.customerUid),
  ]);

  return NextResponse.json({ ok: true, notifications, unreadCount });
}

export async function DELETE(req: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();

  const mutation = validateDeleteNotificationPayload(await req.json().catch(() => null));
  if (mutation.ok === false) {
    return NextResponse.json({ error: mutation.error }, { status: 400 });
  }
  if (mutation.data.clearAll) {
    await clearCustomerNotifications(user.customerUid);
  } else {
    await deleteCustomerNotifications(user.customerUid, mutation.data.ids);
  }
  const [notifications, unreadCount] = await Promise.all([
    listCustomerNotifications(user.customerUid, 20),
    countUnreadCustomerNotifications(user.customerUid),
  ]);
  return NextResponse.json({ ok: true, notifications, unreadCount });
}
