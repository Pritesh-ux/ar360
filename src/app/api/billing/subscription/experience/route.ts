import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSubscriptionExperience } from "@/server/billing/subscription-experience.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const experience = await getSubscriptionExperience(user.customerUid);
  return NextResponse.json(
    { success: true, experience },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
