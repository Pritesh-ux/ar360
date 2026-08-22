import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  confirmPhoneVerificationCode,
  getAccountVerificationState,
  sendEmailVerificationLink,
  sendPhoneVerificationCode,
} from "@/lib/account/verification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user.customerUid) {
    return NextResponse.json({ error: "Customer session required." }, { status: 401 });
  }
  const state = await getAccountVerificationState(user.id, user.customerUid);
  return NextResponse.json({ success: true, verification: state });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user.customerUid) {
    return NextResponse.json({ error: "Customer session required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  try {
    if (action === "send_email") {
      const result = await sendEmailVerificationLink({ userId: user.id, email: user.email });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "send_phone") {
      const phone = String(body.phone || "").trim();
      const result = await sendPhoneVerificationCode({
        userId: user.id,
        customerUid: user.customerUid,
        email: user.email,
        phone,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "confirm_phone") {
      const result = await confirmPhoneVerificationCode({
        customerUid: user.customerUid,
        code: String(body.code || ""),
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed." },
      { status: 400 },
    );
  }
}
