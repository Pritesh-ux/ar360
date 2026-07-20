import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUsageForApi } from "@/lib/billing/limit-enforcement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/customer/usage — authenticated customer usage snapshot. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.customerUid) {
      return NextResponse.json({ success: false, error: "Login required." }, { status: 401 });
    }

    const usage = await getUsageForApi(user.customerUid);

    return NextResponse.json(
      {
        success: true,
        plan: usage.plan,
        subscription: usage.subscription,
        usage: {
          products: usage.products,
          storage: usage.storage,
          bandwidth: usage.bandwidth,
          qrCodes: usage.qrCodes,
          shareLinks: usage.shareLinks,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[customer/usage]", error);
    return NextResponse.json(
      { success: false, error: "Unable to load usage data. Please try again." },
      { status: 500 },
    );
  }
}
