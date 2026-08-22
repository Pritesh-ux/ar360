import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { generateInvoicePdfBuffer } from "@/lib/billing/invoice-pdf";
import { createZipStoreBuffer } from "@/lib/zip-store";
import { listAllInvoices } from "@/server/billing/invoice.repository";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function safeFilePart(value: string) {
  return String(value || "invoice")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function GET(req: Request) {
  const auth = await guardAdminPermission(["billing.read", "exports.download"]);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || 500);
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 500), 1000);

  const invoices = await listAllInvoices(limit);
  if (!invoices.length) {
    return NextResponse.json({ error: "No invoices found to download." }, { status: 404 });
  }

  const entries: { name: string; data: Buffer }[] = [];
  const usedNames = new Set<string>();

  for (const invoice of invoices) {
    try {
      const pdf = await generateInvoicePdfBuffer(invoice);
      const base = safeFilePart(invoice.invoice_number || invoice.invoice_uid);
      let name = `${base}.pdf`;
      let i = 2;
      while (usedNames.has(name)) {
        name = `${base}-${i}.pdf`;
        i += 1;
      }
      usedNames.add(name);
      entries.push({ name, data: pdf });
    } catch (error) {
      console.error("Bulk invoice PDF failed", invoice.invoice_uid, error);
    }
  }

  if (!entries.length) {
    return NextResponse.json({ error: "Could not generate any invoice PDFs." }, { status: 500 });
  }

  const zip = createZipStoreBuffer(entries);
  const stamp = new Date().toISOString().slice(0, 10);

  await writeMasterAdminAudit({
    adminId: auth.admin.id,
    action: "billing.invoices.bulk_download",
    entityType: "billing_invoices",
    entityId: null,
    metadata: { count: entries.length, requestedLimit: limit },
  }).catch(() => undefined);

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="ar360-invoices-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
