import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { sendPaymentReminder } from "@/lib/master-admin/billing-actions.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("billing.read");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  const body = await req.json().catch(() => ({}));
  const paymentUid = String(body.paymentUid || "").trim();
  if (!paymentUid) {
    return NextResponse.json({ error: "paymentUid is required." }, { status: 400 });
  }

  try {
    const result = await sendPaymentReminder({ paymentUid, adminId: admin.id });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reminder failed." },
      { status: 400 },
    );
  }
}
