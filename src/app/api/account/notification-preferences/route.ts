import { NextRequest, NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { getNotificationPreferences, saveNotificationPreferences } from "@/lib/account/notify.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const preferences = await getNotificationPreferences(user.id);
  return NextResponse.json({ success: true, preferences });
}

export async function PATCH(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const body = await request.json();
  const preferences = await saveNotificationPreferences(user.id, user.customerUid, body.preferences || body);
  return NextResponse.json({ success: true, preferences });
}
