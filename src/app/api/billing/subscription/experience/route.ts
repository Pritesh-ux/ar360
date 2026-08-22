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

  try {
    const experience = await getSubscriptionExperience(user.customerUid);
    if (!experience) {
      return NextResponse.json(
        { error: "No subscription found for this account.", experience: null },
        { status: 404, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json(
      { success: true, experience },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[billing/subscription/experience]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Subscription details could not be loaded.",
      },
      { status: 500 },
    );
  }
}
