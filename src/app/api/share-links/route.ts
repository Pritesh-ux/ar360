import { NextRequest, NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import {
  createCustomerShareLink,
  listCustomerShareLinks,
  type ShareLinkType,
  type ShareStatusFilter,
} from "@/lib/user-panel/share-links.service";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { resolveBrandedOriginForCustomer } from "@/lib/enterprise/branded-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FILTERS = new Set<ShareStatusFilter>(["active", "expired", "archived", "all"]);
const LINK_TYPES = new Set<ShareLinkType>(["public", "embed", "email"]);

async function gateUser(action: "share" | "access_dashboard" = "share") {
  const user = await requireScopedApiUser();
  if (!user) return { error: rejectScopedApiUser() };
  const permission = await enforcePermission(user.customerUid, action);
  if (!permission.ok) return { error: permission.response };
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await gateUser("share");
    if ("error" in gate && gate.error) return gate.error;
    const user = gate.user!;

    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const status = STATUS_FILTERS.has(statusParam as ShareStatusFilter)
      ? (statusParam as ShareStatusFilter)
      : "all";

    const typeParam = searchParams.get("linkType");
    const linkType =
      typeParam && LINK_TYPES.has(typeParam as ShareLinkType) ? (typeParam as ShareLinkType) : "all";

    const origin = await resolveBrandedOriginForCustomer(user.customerUid, request);
    const data = await listCustomerShareLinks({
      customerUid: user.customerUid,
      userId: user.id,
      origin,
      q: searchParams.get("q") || undefined,
      status,
      linkType,
      productId: searchParams.get("productId") || undefined,
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "12"),
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("[share-links GET]", error);
    return NextResponse.json({ error: "Failed to load share links." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await gateUser("share");
    if ("error" in gate && gate.error) return gate.error;
    const user = gate.user!;

    const body = await request.json();
    const productId = String(body.productId || "");
    if (!productId) {
      return NextResponse.json({ error: "Product is required." }, { status: 400 });
    }

    const linkType = LINK_TYPES.has(body.linkType) ? body.linkType : "public";
    const origin = await resolveBrandedOriginForCustomer(user.customerUid, request);

    const result = await createCustomerShareLink({
      customerUid: user.customerUid,
      userId: user.id,
      productId,
      origin,
      linkType,
      slug: body.slug ?? null,
      expiresAt: body.expiresAt ?? null,
      password: body.password ?? null,
    });

    if ("error" in result) {
      const status = result.error === "Product not found." ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true, shareLink: result.shareLink }, { status: 201 });
  } catch (error) {
    console.error("[share-links POST]", error);
    return NextResponse.json({ error: "Failed to create share link." }, { status: 500 });
  }
}
