import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getBillingProfileForCustomer, saveBillingProfile } from "@/server/billing/invoice.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const profile = await getBillingProfileForCustomer(user.customerUid);
  return NextResponse.json({ success: true, profile });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user?.customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.fullName || body.billing_name || "").trim();

  if (fullName) {
    await query("UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?", [fullName, user.id]);
    await query("UPDATE customers SET contact_name = ?, updated_at = NOW() WHERE customer_uid = ?", [
      fullName,
      user.customerUid,
    ]);
  }

  const profile = await saveBillingProfile(user.customerUid, {
    company_name: body.companyName || body.company_name || null,
    billing_name: fullName || body.billing_name || null,
    billing_email: body.email || body.billing_email || user.email || null,
    billing_phone: body.phone || body.billing_phone || null,
    gstin: body.gst || body.gstin || null,
    address_line1: body.address || body.address_line1 || null,
    city: body.city || null,
    state: body.state || null,
    postal_code: body.zip || body.postal_code || null,
    country: body.country || "India",
  });

  return NextResponse.json({ success: true, profile });
}
