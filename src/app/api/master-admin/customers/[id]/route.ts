import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema, query } from "@/lib/db";
import { listLedgerPayments } from "@/lib/billing/payment-ledger";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

type CustomerDetail = {
  customer_uid: string;
  contact_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  plan_id: string;
  status: string;
  storage_used_mb: number;
  bandwidth_used_mb: number;
  created_at: string;
  last_login_at: string | null;
};

type ProductRow = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  file_name: string | null;
  views: number;
  created_at: string;
};

type PaymentRow = {
  payment_uid: string;
  invoice: string;
  plan_id: string;
  billing_cycle: string;
  amount: number;
  gst: number;
  total: number;
  status: string;
  gateway: string;
  transaction_id: string;
  created_at: string;
};

type ActivityRow = {
  id: number;
  action: string;
  created_at: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await guardAdminPermission("customers.read");
  if (auth instanceof NextResponse) return auth;

  await ensureAppSchema();

  const { id } = await params;

  const [customers, products, payments, activity] = await Promise.all([
    query<CustomerDetail>(`
      SELECT c.customer_uid, c.contact_name, c.company_name, c.email, c.phone, c.country,
             c.plan_id, c.status, c.storage_used_mb, c.bandwidth_used_mb, c.created_at,
             u.last_login_at
      FROM customers c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.customer_uid = ?
      LIMIT 1
    `, [id]),

    query<ProductRow>(`
      SELECT id, title, category, status, file_name, views, created_at
      FROM products WHERE customer_uid = ?
      ORDER BY created_at DESC LIMIT 50
    `, [id]),

    listLedgerPayments({ customerUid: id, limit: 20 }).then((rows) =>
      rows.map((row) => ({
        payment_uid: row.id,
        invoice: row.invoice,
        plan_id: row.plan,
        billing_cycle: row.billing,
        amount: row.amount,
        gst: row.gst,
        total: row.total,
        status: row.status,
        gateway: row.gateway,
        transaction_id: row.transactionId,
        created_at: String(row.date),
      })),
    ).catch(() => [] as PaymentRow[]),

    query<ActivityRow>(`
      SELECT id, action, created_at
      FROM audit_logs WHERE customer_uid = ?
      ORDER BY created_at DESC LIMIT 20
    `, [id]).catch(() => [] as ActivityRow[]),
  ]);

  if (!customers[0]) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({
    customer: customers[0],
    products,
    payments,
    activity,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await guardAdminPermission("customers.delete");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureAppSchema();
  const { id: customerUid } = await params;

  const rows = await query<{ user_id: number; status: string }>(
    "SELECT user_id, status FROM customers WHERE customer_uid = ? LIMIT 1",
    [customerUid],
  );
  const customer = rows[0];
  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }
  if (customer.status === "Deleted") {
    return NextResponse.json({ error: "Customer is already deleted." }, { status: 400 });
  }

  await query("UPDATE customers SET status = 'Deleted', updated_at = NOW() WHERE customer_uid = ?", [
    customerUid,
  ]);
  await query("UPDATE users SET status = 'Deleted', updated_at = NOW() WHERE id = ?", [customer.user_id]);
  await query(
    `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
     WHERE customer_uid = ? AND status NOT IN ('cancelled', 'expired')`,
    [customerUid],
  ).catch(() => {});

  await writeMasterAdminAudit({
    adminId: admin.id,
    action: "customer.delete",
    entityType: "customer",
    entityId: customerUid,
  });

  return NextResponse.json({ ok: true });
}
