import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveBrandedOriginForCustomer } from "@/lib/enterprise/branded-origin";
import { requireActiveSubscriptionApi } from "@/lib/subscription/api-subscription-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public origin for editor share / QR copy fields (custom domain when verified). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return gate.response;
  const origin = await resolveBrandedOriginForCustomer(user.customerUid, req);
  return NextResponse.json({ origin });
}
