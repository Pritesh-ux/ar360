import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createCustomerNotification } from "@/lib/account/notify.service";
import { sendProductEnquiryEmail } from "@/lib/email/customer-lifecycle.service";
import { resolveProduct } from "@/server/products/product-resolver";
import { enforcePermission } from "@/lib/billing/api-permission";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { resolveCustomerPlanLimits } from "@/lib/billing/resolve-plan-limits";
import { planAllowsProductContact } from "@/lib/billing/plan-enforcement";
import { getWorkspaceContactSettings } from "@/lib/viewer-contact/workspace-settings";
import { readProductContactOverride, resolveViewerContact } from "@/lib/viewer-contact/resolve";
import {
  createProductEnquiry,
  listProductEnquiries,
  sanitizeViewerUrl,
  validateEnquiryInput,
  verifyClientBelongsToCustomer,
} from "@/lib/viewer-contact/enquiries.service";
import { query } from "@/lib/db";
import type { EnquiryStatus } from "@/lib/viewer-contact/types";
import { ENQUIRY_STATUSES } from "@/lib/viewer-contact/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOrigin(request: Request) {
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, {
    scope: "product-enquiries:submit",
    limit: 8,
    windowSec: 3600,
  });
  if (limited instanceof Response) {
    return NextResponse.json({ error: "Too many enquiries. Please try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const productId = String(body.productId || "").trim();
  if (!productId) {
    return NextResponse.json({ error: "Product is required." }, { status: 400 });
  }

  const fields = validateEnquiryInput({
    name: String(body.name || ""),
    phone: String(body.phone || ""),
    email: String(body.email || ""),
    message: String(body.message || ""),
  });
  if (fields.ok === false) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  const resolved = await resolveProduct(productId).catch(() => null);
  if (!resolved?.productId || !resolved.customerUid) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const productRows = await query<{ title: string; status: string; settings: unknown }>(
    `SELECT title, status, settings FROM products WHERE id = ? AND customer_uid = ? LIMIT 1`,
    [resolved.productId, resolved.customerUid],
  ).catch(() => []);
  const product = productRows[0];
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  const status = String(product.status || "").toLowerCase();
  if (status !== "published" && status !== "active") {
    return NextResponse.json({ error: "This product is not accepting enquiries." }, { status: 404 });
  }

  const ownerPlan = await resolveCustomerPlanLimits(resolved.customerUid).catch(() => null);
  if (!ownerPlan || !planAllowsProductContact(ownerPlan)) {
    return NextResponse.json({ error: "Enquiries are not available on this plan." }, { status: 403 });
  }

  const workspace = await getWorkspaceContactSettings(resolved.customerUid);
  const settingsBag =
    product.settings && typeof product.settings === "object" && !Array.isArray(product.settings)
      ? (product.settings as Record<string, unknown>)
      : {};
  const requestedClient = String(body.clientUid || "").trim();
  const clientUid =
    requestedClient && (await verifyClientBelongsToCustomer(requestedClient, resolved.customerUid))
      ? requestedClient
      : null;
  let clientPhone: string | null = null;
  if (clientUid) {
    const clientRows = await query<{ phone: string | null }>(
      `SELECT phone FROM clients WHERE client_uid = ? AND customer_uid = ? LIMIT 1`,
      [clientUid, resolved.customerUid],
    ).catch(() => []);
    clientPhone = clientRows[0]?.phone || null;
  }
  const contact = resolveViewerContact(workspace.settings, readProductContactOverride(settingsBag), {
    clientPhone,
  });
  if (!contact.enquireEnabled) {
    return NextResponse.json({ error: "Enquiries are not enabled for this product." }, { status: 403 });
  }

  try {
    const enquiry = await createProductEnquiry({
      customerUid: resolved.customerUid,
      workspaceUid: workspace.workspaceUid,
      clientUid,
      productId: resolved.productId,
      productTitle: String(product.title || resolved.productId),
      visitorName: fields.name,
      visitorPhone: fields.phone,
      visitorEmail: fields.email,
      message: fields.message,
      source: "viewer",
      viewerUrl: sanitizeViewerUrl(String(body.viewerUrl || ""), resolved.productId, requestOrigin(request)),
    });

    void createCustomerNotification({
      customerUid: resolved.customerUid,
      category: "product",
      title: "New product enquiry",
      body: `${enquiry.visitorName} enquired about ${enquiry.productTitle}.`,
      href: "/dashboard/enquiries",
      dedupeKey: `enquiry:${enquiry.enquiryUid}`,
    }).catch(() => undefined);

    void sendProductEnquiryEmail({
      customerUid: resolved.customerUid,
      enquiryUid: enquiry.enquiryUid,
      productTitle: enquiry.productTitle,
      visitorName: enquiry.visitorName,
      visitorPhone: enquiry.visitorPhone,
      visitorEmail: enquiry.visitorEmail,
      message: enquiry.message,
      viewerUrl: enquiry.viewerUrl,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, enquiryUid: enquiry.enquiryUid });
  } catch (error) {
    console.error("[product-enquiries] create", error);
    return NextResponse.json({ error: "Could not send enquiry right now." }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const user = await requireScopedApiUser();
  if (!user) return rejectScopedApiUser();
  const permission = await enforcePermission(user.customerUid, "product_contact");
  if (!permission.ok) return permission.response;

  const statusParam = request.nextUrl.searchParams.get("status") || "all";
  const status =
    statusParam === "all" || ENQUIRY_STATUSES.includes(statusParam as EnquiryStatus)
      ? (statusParam as EnquiryStatus | "all")
      : "all";
  const result = await listProductEnquiries({
    customerUid: user.customerUid,
    status,
    q: request.nextUrl.searchParams.get("q") || "",
    page: Number(request.nextUrl.searchParams.get("page") || 1),
    pageSize: Number(request.nextUrl.searchParams.get("pageSize") || 20),
  });
  return NextResponse.json(result);
}
