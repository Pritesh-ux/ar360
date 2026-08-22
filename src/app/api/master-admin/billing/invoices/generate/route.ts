import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { ensureAppSchema } from "@/lib/db";
import { adminGenerateInvoice } from "@/lib/master-admin/billing-actions.service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await guardAdminPermission("invoices.generate");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  await ensureAppSchema();
  const body = await req.json().catch(() => ({}));

  try {
    const invoice = await adminGenerateInvoice({
      customerUid: String(body.customerUid || "").trim(),
      planId: String(body.planId || "").trim(),
      period: body.period === "yearly" ? "yearly" : "monthly",
      amountPaise: body.amountPaise ? Number(body.amountPaise) : undefined,
      adminId: admin.id,
    });

    await logAdminAudit(admin, "invoice.generate", "invoice", invoice?.invoice_uid || null, {
      customerUid: body.customerUid,
      planId: body.planId,
    });
    return NextResponse.json({
      ok: true,
      invoice: {
        invoiceUid: invoice?.invoice_uid,
        invoiceNumber: invoice?.invoice_number,
        totalPaise: invoice?.total_paise,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generate failed." },
      { status: 400 },
    );
  }
}
