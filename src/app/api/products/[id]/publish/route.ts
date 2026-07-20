import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import {
  clientCustomerScopeIsValid,
  normalizeScopedId,
  verifyCustomerProductAccess,
} from "@/lib/customerIsolation";
import { buildPreviewChecklist, publishCustomerProduct } from "@/lib/products/publish.service";
import { ProductErrorCode } from "@/lib/products/product-errors";
import { enforcePermission } from "@/lib/billing/api-permission";
import { resolveBrandedOriginForCustomer } from "@/lib/enterprise/branded-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const { id } = await context.params;
  const productUid = normalizeScopedId(id);
  if (!productUid) return NextResponse.json({ error: "Invalid product id." }, { status: 400 });

  const ownership = await verifyCustomerProductAccess({ user, productUid });
  if (!ownership.ok) return NextResponse.json({ error: ownership.reason }, { status: 403 });

  const checklist = await buildPreviewChecklist({
    customerUid: ownership.customerUid,
    productUid,
  });

  return NextResponse.json({ success: true, ...checklist });
}

export async function POST(req: Request, context: RouteContext) {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const permission = await enforcePermission(user.customerUid ?? "", "upload", { isEdit: true });
  if (!permission.ok) return permission.response;

  const { id } = await context.params;
  const productUid = normalizeScopedId(id);
  if (!productUid) return NextResponse.json({ error: "Invalid product id." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clientCustomerUid = String(body.customerUid || "").trim();
  if (!clientCustomerScopeIsValid(user, clientCustomerUid)) {
    return NextResponse.json({ error: "Forbidden customer scope." }, { status: 403 });
  }

  const ownership = await verifyCustomerProductAccess({ user, productUid });
  if (!ownership.ok) return NextResponse.json({ error: ownership.reason }, { status: 403 });

  const result = await publishCustomerProduct({
    customerUid: ownership.customerUid,
    userId: user.id,
    productUid,
    origin: await resolveBrandedOriginForCustomer(ownership.customerUid, req),
    title: body.title ? String(body.title) : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, code: result.code, error: result.error },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    product: result.product,
    publicId: result.publicId,
    viewerUrl: result.viewerUrl,
    checklist: result.checklist,
  });
}
