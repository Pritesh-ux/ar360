import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import {
  createEnterpriseRenewalRequest,
  getEnterpriseDashboard,
} from "@/lib/enterprise-sales/customer-dashboard.service";
import { requireActiveSubscriptionApi } from "@/lib/subscription/api-subscription-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireEnterpriseCustomer() {
  const user = await requireApiUser();
  if (!user?.customerUid) {
    return { response: NextResponse.json({ error: "Login required." }, { status: 401 }) };
  }
  const gate = await requireActiveSubscriptionApi(user.customerUid ?? "");
  if (!gate.ok) return { response: gate.response };
  const dashboard = await getEnterpriseDashboard(user.customerUid);
  if (!dashboard) {
    return {
      response: NextResponse.json(
        { error: "An active Enterprise contract is required." },
        { status: 403 },
      ),
    };
  }
  return { user, dashboard };
}

export async function GET() {
  try {
    const auth = await requireEnterpriseCustomer();
    if ("response" in auth) return auth.response;
    return NextResponse.json({ dashboard: auth.dashboard });
  } catch {
    return NextResponse.json(
      { error: "Enterprise dashboard is temporarily unavailable." },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const auth = await requireEnterpriseCustomer();
    if ("response" in auth) return auth.response;
    const renewal = await createEnterpriseRenewalRequest(auth.user.customerUid);
    if (!renewal) {
      return NextResponse.json(
        { error: "An active Enterprise contract is required." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { renewal },
      { status: renewal.created ? 201 : 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to submit the renewal request." },
      { status: 500 },
    );
  }
}
