import { NextRequest, NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { generateInvoicePdfBuffer } from "@/lib/billing/invoice-pdf";
import { getInvoiceForDownload } from "@/lib/master-admin/billing-actions.service";
import { getMasterInvoiceHtml } from "@/server/billing/invoice.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission(["billing.read", "exports.download"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") || "html";

  const invoice = await getInvoiceForDownload(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  if (format === "pdf") {
    const pdf = await generateInvoicePdfBuffer(invoice);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number || id}.pdf"`,
      },
    });
  }

  const html = await getMasterInvoiceHtml(id);
  if (!html) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="invoice-${id}.html"`,
    },
  });
}
