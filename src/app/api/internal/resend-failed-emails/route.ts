import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  sendInvoiceEmail,
  sendPlanActivatedEmail,
  sendWelcomeEmail,
} from "@/lib/email/customer-lifecycle.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FailedRow = {
  customer_uid: string;
  dedupe_key: string;
  template_id: string;
  recipient: string;
};

function authorized(request: NextRequest) {
  const key = request.headers.get("x-ar360-internal-key") || "";
  const expected = process.env.AR360_INTERNAL_KEY || "";
  return Boolean(expected) && key === expected;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await query<FailedRow>(
    `SELECT customer_uid, dedupe_key, template_id, recipient
       FROM customer_email_deliveries
      WHERE status = 'failed'
      ORDER BY id ASC
      LIMIT 100`,
  );

  const results: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    try {
      if (row.template_id === "customer_welcome") {
        const result = await sendWelcomeEmail(row.customer_uid);
        results.push({ template: row.template_id, recipient: row.recipient, ...result });
        continue;
      }

      if (row.template_id === "plan_activated") {
        const eventKey = row.dedupe_key.replace(/^plan-activated:/, "") || `retry:${Date.now()}`;
        const planRows = await query<{ plan_id: string | null }>(
          `SELECT plan_id FROM customers WHERE customer_uid = ? LIMIT 1`,
          [row.customer_uid],
        );
        const result = await sendPlanActivatedEmail({
          customerUid: row.customer_uid,
          planId: planRows[0]?.plan_id || "trial",
          eventKey,
        });
        results.push({ template: row.template_id, recipient: row.recipient, ...result });
        continue;
      }

      if (row.template_id === "invoice_ready") {
        const match = row.dedupe_key.match(/^invoice:([^:]+):/);
        const invoiceUid = match?.[1];
        if (!invoiceUid) {
          results.push({ template: row.template_id, recipient: row.recipient, error: "missing_invoice_uid" });
          continue;
        }
        const invoiceRows = await query<{
          invoice_number: string | null;
          plan_id: string | null;
          total_paise: number | null;
          status: string | null;
        }>(
          `SELECT invoice_number, plan_id, total_paise, status
             FROM billing_invoices WHERE invoice_uid = ? LIMIT 1`,
          [invoiceUid],
        );
        const invoice = invoiceRows[0];
        const result = await sendInvoiceEmail({
          customerUid: row.customer_uid,
          invoiceUid,
          invoiceNumber: invoice?.invoice_number,
          planId: invoice?.plan_id,
          amountPaise: invoice?.total_paise,
          status: invoice?.status || "created",
        });
        results.push({ template: row.template_id, recipient: row.recipient, ...result });
        continue;
      }

      results.push({
        template: row.template_id,
        recipient: row.recipient,
        skipped: true,
        reason: "unsupported_template",
      });
    } catch (error) {
      results.push({
        template: row.template_id,
        recipient: row.recipient,
        error: error instanceof Error ? error.message : "resend_failed",
      });
    }
  }

  const delivered = results.filter((row) => row.delivered === true).length;
  return NextResponse.json({
    ok: true,
    attempted: results.length,
    delivered,
    results,
  });
}
