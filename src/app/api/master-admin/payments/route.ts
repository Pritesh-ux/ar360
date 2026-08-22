import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import {
  createManualLedgerPayment,
  formatLedgerPayment,
  listLedgerPayments,
  updateLedgerPaymentStatus,
} from "@/lib/billing/payment-ledger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await guardAdminPermission("billing.read");
    if (auth instanceof NextResponse) return auth;

    await ensureAppSchema();

    const rows = await listLedgerPayments();
    const formatted = rows.map((row) => formatLedgerPayment(row));

    return NextResponse.json({ payments: formatted });
  } catch (error) {
    console.error("Failed to load payments", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await guardAdminPermission("billing.manual_payment");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const body = await req.json();
    const { email, plan, billing, amount, gateway, paymentMethod, notes } = body;

    if (!email || !plan || !billing || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const customers = await query<{ customer_uid: string; contact_name: string }>(
      "SELECT customer_uid, contact_name FROM customers WHERE email = ? LIMIT 1",
      [email],
    );

    if (!customers[0]) {
      return NextResponse.json({ error: "Customer email not found." }, { status: 400 });
    }

    const customerUid = customers[0].customer_uid;
    const customerName = customers[0].contact_name;

    await ensureAppSchema();

    const payment = await createManualLedgerPayment({
      customerUid,
      planId: plan,
      billing,
      amountInr: Number(amount),
      gateway,
      paymentMethod,
      notes,
    });

    await logAdminAudit(admin, "payment.manual_create", "payment", payment.id, { customerUid, plan });
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        invoice: payment.invoice,
        customer: customerName,
        email,
        plan,
        billing,
        amount: payment.amount,
        gst: payment.gst,
        total: payment.total,
        status: payment.status,
        gateway: payment.gateway,
        transactionId: payment.transactionId,
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        expiryDate: "Pending",
        paymentMethod,
        notes: payment.notes,
      },
    });
  } catch (error) {
    console.error("Failed to add payment", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await guardAdminPermission("billing.manual_payment");
    if (auth instanceof NextResponse) return auth;
    const { admin } = auth;

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    await ensureAppSchema();
    await updateLedgerPaymentStatus(String(id), String(status));
    await logAdminAudit(admin, "payment.status_update", "payment", String(id), { status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update payment status", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
