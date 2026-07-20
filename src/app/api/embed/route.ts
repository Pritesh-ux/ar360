import { NextResponse } from "next/server";
import { rejectScopedApiUser, requireScopedApiUser } from "@/lib/user-panel/api-guard";
import { enforcePermission } from "@/lib/billing/api-permission";
import { listCustomerEmbeds, updateEmbedConfig } from "@/lib/growth/embed.service";
import { resolveBrandedOriginForCustomer } from "@/lib/enterprise/branded-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate() {
  const user = await requireScopedApiUser();
  if (!user) return { error: rejectScopedApiUser() };
  const permission = await enforcePermission(user.customerUid, "embed");
  if (!permission.ok) return { error: permission.response };
  return { user };
}

export async function GET(request: Request) {
  const g = await gate();
  if ("error" in g && g.error) return g.error;

  const { searchParams } = new URL(request.url);
  const origin = await resolveBrandedOriginForCustomer(g.user!.customerUid, request);
  const embeds = await listCustomerEmbeds({
    customerUid: g.user!.customerUid,
    userId: g.user!.id,
    origin,
    q: searchParams.get("q") || undefined,
    productId: searchParams.get("productId") || undefined,
  });

  return NextResponse.json({ success: true, embeds });
}

export async function PATCH(request: Request) {
  const g = await gate();
  if ("error" in g && g.error) return g.error;

  const body = await request.json();
  const embedId = Number(body.id);
  if (!Number.isFinite(embedId)) return NextResponse.json({ error: "Embed id required." }, { status: 400 });

  const result = await updateEmbedConfig({
    customerUid: g.user!.customerUid,
    userId: g.user!.id,
    embedId,
    status: body.status,
    allowedDomains: Array.isArray(body.allowedDomains) ? body.allowedDomains.map(String) : undefined,
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
