import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";
import {
  consentToLegacyRenewal,
  getLegacyRenewalStatus,
} from "@/server/billing/legacy-renewal-migration.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) return NextResponse.json({ error: "Login required." }, { status: 401 });
  return NextResponse.json({ success: true, renewal: await getLegacyRenewalStatus(user.customerUid) });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.customerUid) return NextResponse.json({ error: "Login required." }, { status: 401 });
    const denied = await guardBillingMutation(request, String(user.id || user.customerUid));
    if (denied) return denied;
    const body = await request.json();
    if (body.explicitConsent !== true) {
      return NextResponse.json({ error: "Explicit recurring-payment consent is required." }, { status: 400 });
    }
    const idempotencyKey = String(request.headers.get("Idempotency-Key") || body.idempotencyKey || "");
    const checkout = await consentToLegacyRenewal({
      customerUid: user.customerUid,
      userId: String(user.id || ""),
      customer: { name: user.name || "", email: user.email || "" },
      idempotencyKey,
      termsVersion: String(body.termsVersion || ""),
    });
    return NextResponse.json({ success: true, ...checkout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Renewal mandate setup failed.";
    const conflict = /already|progress|ended|not available/i.test(message);
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
  }
}
