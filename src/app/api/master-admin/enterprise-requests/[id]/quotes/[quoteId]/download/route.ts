import { NextRequest, NextResponse } from "next/server";
import { getEnterpriseQuoteForDocument } from "@/lib/enterprise-sales";
import { generateEnterpriseQuotePdfBuffer } from "@/lib/enterprise-sales/quote-pdf";
import { writeMasterAdminAudit } from "@/lib/master-admin/audit-log";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> },
) {
  const auth = await guardAdminPermission("enterprise_requests.manage", { request });
  if (auth instanceof NextResponse) return auth;
  const { id, quoteId } = await params;
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(quoteId)) {
    return NextResponse.json({ error: "Quote ID is invalid" }, { status: 400 });
  }
  const quote = await getEnterpriseQuoteForDocument(id, quoteId);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  const pdf = await generateEnterpriseQuotePdfBuffer(quote);
  await writeMasterAdminAudit({
    adminId: auth.admin.id,
    action: "enterprise_quote.downloaded",
    entityType: "enterprise_quote",
    entityId: quoteId,
    metadata: { requestUid: id, version: Number(quote.version) },
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quote_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
