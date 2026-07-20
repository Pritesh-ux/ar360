import { NextRequest, NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { updateCustomerShareLink, type ShareLinkType } from "@/lib/user-panel/share-links.service";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { resolveBrandedOriginForCustomer } from "@/lib/enterprise/branded-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LINK_TYPES = new Set<ShareLinkType>(["public", "embed", "email"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireScopedApiUser();
    if (!user) return rejectScopedApiUser();

    const permission = await enforcePermission(user.customerUid, "share");
    if (!permission.ok) return permission.response;

    const { id: idParam } = await context.params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid share link id." }, { status: 400 });
    }

    const body = await request.json();
    const linkType = LINK_TYPES.has(body.linkType) ? body.linkType : undefined;
    const origin = await resolveBrandedOriginForCustomer(user.customerUid, request);

    const result = await updateCustomerShareLink({
      customerUid: user.customerUid,
      userId: user.id,
      id,
      origin,
      patch: {
        slug: body.slug,
        linkType,
        expiresAt: body.expiresAt,
        password: body.password,
        clearPassword: Boolean(body.clearPassword),
        status: body.status,
      },
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[share-links PATCH]", error);
    return NextResponse.json({ error: "Failed to update share link." }, { status: 500 });
  }
}
