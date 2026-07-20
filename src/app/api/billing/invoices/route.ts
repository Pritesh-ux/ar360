import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCustomerInvoices } from "@/server/billing/invoice.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  const customerUid = user?.customerUid;

  if (!user || !customerUid) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const invoices = await getCustomerInvoices(customerUid);
  return NextResponse.json({ invoices });
}
