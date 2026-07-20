import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import { normalizeScopedId } from "@/lib/customerIsolation";
import { duplicateCustomerProduct } from "@/lib/user-panel/products.service";
import {
  rejectScopedApiUser,
  requireScopedApiUser,
} from "@/lib/user-panel/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  try {
    const user = await requireScopedApiUser();
    if (!user) return rejectScopedApiUser();

    const permission = await enforcePermission(user.customerUid, "create_product");
    if (!permission.ok) return permission.response;

    const params = await context.params;
    const sourceProductUid = normalizeScopedId(params.id);
    if (!sourceProductUid) {
      return NextResponse.json({ error: "Product id required." }, { status: 400 });
    }

    const result = await duplicateCustomerProduct({
      customerUid: user.customerUid,
      userId: user.id,
      sourceProductUid,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duplicate failed.";
    const status = message.includes("not found")
      ? 404
      : message.toLowerCase().includes("limit") || message.includes("storage remaining")
        ? 403
        : 500;
    console.error("[products/[id]/duplicate]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
