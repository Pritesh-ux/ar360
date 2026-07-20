import { NextResponse } from "next/server";
import { enforcePermission } from "@/lib/billing/api-permission";
import {
  listCustomerProducts,
  type ProductSortKey,
} from "@/lib/user-panel/products.service";
import {
  rejectScopedApiUser,
  requireScopedApiUser,
} from "@/lib/user-panel/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORT_KEYS = new Set<ProductSortKey>([
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "views",
  "updated",
]);

export async function GET(request: Request) {
  try {
    const user = await requireScopedApiUser();
    if (!user) return rejectScopedApiUser();

    const permission = await enforcePermission(user.customerUid, "access_dashboard");
    if (!permission.ok) return permission.response;

    const { searchParams } = new URL(request.url);
    const sortParam = searchParams.get("sort");
    const sort = SORT_KEYS.has(sortParam as ProductSortKey)
      ? (sortParam as ProductSortKey)
      : "newest";

    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "8");

    const data = await listCustomerProducts({
      customerUid: user.customerUid,
      userId: user.id,
      q: searchParams.get("q") || undefined,
      folder: searchParams.get("folder") || undefined,
      status: searchParams.get("status") || undefined,
      category: searchParams.get("category") || undefined,
      sort,
      page,
      pageSize,
      excludeClientLinked:
        searchParams.get("excludeClientLinked") === "1" ||
        searchParams.get("excludeClientLinked") === "true",
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error("[products GET]", error);
    return NextResponse.json({ error: "Failed to load products." }, { status: 500 });
  }
}
