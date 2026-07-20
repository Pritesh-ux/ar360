import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import {
  listAddonLicenses,
  listAllAddonModules,
  updateAddonModule,
} from "@/lib/billing/addons";

export const runtime = "nodejs";

export async function GET() {
  const auth = await guardAdminPermission("billing.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const [modules, licenses] = await Promise.all([
      listAllAddonModules(),
      listAddonLicenses(200),
    ]);
    return NextResponse.json({ success: true, modules, licenses });
  } catch (error) {
    console.error("GET /api/master-admin/addons error:", error);
    return NextResponse.json({ error: "Failed to load add-ons." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await guardAdminPermission("billing.manual_payment");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      slug?: string;
      name?: string;
      description?: string | null;
      monthly_price?: number;
      yearly_price?: number;
      one_time_price?: number | null;
      trial_days?: number;
      enabled?: boolean;
      business_available?: boolean;
      enterprise_available?: boolean;
      custom_available?: boolean;
      sort_order?: number;
      currency?: string;
      discount_percent?: number;
      status?: string;
      visibility?: string;
    };

    const slug = String(body.slug || "").trim();
    if (!slug) {
      return NextResponse.json({ error: "slug is required." }, { status: 400 });
    }

    await updateAddonModule(slug, {
      name: body.name,
      description: body.description,
      monthly_price: body.monthly_price,
      yearly_price: body.yearly_price,
      one_time_price: body.one_time_price,
      trial_days: body.trial_days,
      enabled: body.enabled,
      business_available: body.business_available,
      enterprise_available: body.enterprise_available,
      custom_available: body.custom_available,
      sort_order: body.sort_order,
      currency: body.currency,
      discount_percent: body.discount_percent,
      status: body.status,
      visibility: body.visibility,
    });

    const modules = await listAllAddonModules();
    return NextResponse.json({ success: true, modules });
  } catch (error) {
    console.error("PATCH /api/master-admin/addons error:", error);
    return NextResponse.json({ error: "Failed to update add-on." }, { status: 500 });
  }
}
