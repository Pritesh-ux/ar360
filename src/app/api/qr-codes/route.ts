import { NextRequest, NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import {
  createCustomerQrCode,
  listCustomerQrCodes,
  updateCustomerQrCode,
  type QrStatusFilter,
} from "@/lib/growth/qr.service.impl";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { resolveBrandedOriginForCustomer } from "@/lib/enterprise/branded-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_FILTERS = new Set<QrStatusFilter>(["active", "expired", "archived", "all"]);

async function gateUser() {
  const user = await requireScopedApiUser();
  if (!user) return { error: rejectScopedApiUser() };
  const permission = await enforcePermission(user.customerUid, "qr");
  if (!permission.ok) return { error: permission.response };
  return { user };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await gateUser();
    if ("error" in gate && gate.error) return gate.error;
    const user = gate.user!;

    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const status = STATUS_FILTERS.has(statusParam as QrStatusFilter)
      ? (statusParam as QrStatusFilter)
      : "all";

    const origin = await resolveBrandedOriginForCustomer(user.customerUid, request);
    const data = await listCustomerQrCodes({
      customerUid: user.customerUid,
      userId: user.id,
      q: searchParams.get("q") || undefined,
      status,
      productId: searchParams.get("productId") || undefined,
      page: Number(searchParams.get("page") || "1"),
      pageSize: Number(searchParams.get("pageSize") || "12"),
      origin,
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("[qr-codes GET]", error);
    return NextResponse.json({ error: "Failed to load product QR codes." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await gateUser();
    if ("error" in gate && gate.error) return gate.error;
    const user = gate.user!;

    const body = await request.json();
    const productId = String(body.productId || "");
    if (!productId) {
      return NextResponse.json({ error: "Product is required." }, { status: 400 });
    }

    const result = await createCustomerQrCode();

    if ("error" in result) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 403 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[qr-codes POST]", error);
    return NextResponse.json({ error: "Failed to create QR code." }, { status: 500 });
  }
}

/** @deprecated Prefer PATCH /api/qr-codes/[id] — kept for backward compatibility */
export async function PUT(request: NextRequest) {
  try {
    const gate = await gateUser();
    if ("error" in gate && gate.error) return gate.error;
    const user = gate.user!;

    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "QR id is required." }, { status: 400 });
    }

    const result = await updateCustomerQrCode({
      customerUid: user.customerUid,
      userId: user.id,
      id,
      patch: {
        foregroundColor: body.foregroundColor,
        backgroundColor: body.backgroundColor,
        patternStyle: body.patternStyle,
        cornerStyle: body.cornerStyle,
        logoUrl: body.logoUrl,
        logoSize: body.logoSize,
        frameEnabled: body.frameEnabled,
        frameStyle: body.frameStyle,
        frameColor: body.frameColor,
        frameText: body.frameText,
      },
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[qr-codes PUT]", error);
    return NextResponse.json({ error: "Failed to save QR design." }, { status: 500 });
  }
}
