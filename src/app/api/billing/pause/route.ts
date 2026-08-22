import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { guardBillingMutation } from "@/server/billing/billing-mutation-guard";

export const runtime = "nodejs";

/** Customer self-service pause is disabled — Master Admin / support only. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const denied = await guardBillingMutation(req, String(user.id || user.customerUid));
  if (denied) return denied;

  return NextResponse.json(
    {
      error: "Pause is not available from your account. Contact AR360 support or your account manager.",
      code: "CUSTOMER_LIFECYCLE_DISABLED",
    },
    { status: 403 },
  );
}
