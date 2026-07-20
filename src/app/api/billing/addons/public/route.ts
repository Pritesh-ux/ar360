import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { AddonModule } from "@/lib/billing/addons";

export const runtime = "nodejs";

/** Public marketing catalog — no auth. Used on landing/pricing pages. */
export async function GET() {
  try {
    const rows = await query<AddonModule>(
      `SELECT name, slug, description, monthly_price, yearly_price, one_time_price,
              currency, business_available, enterprise_available, custom_available, sort_order
         FROM addon_modules
        WHERE enabled = TRUE AND status = 'active' AND visibility = 'public'
        ORDER BY sort_order ASC`,
    );

    return NextResponse.json({
      success: true,
      addons: rows.map((row) => ({
        name: row.name,
        slug: row.slug,
        description: row.description,
        monthlyPrice: row.monthly_price,
        yearlyPrice: row.yearly_price,
        oneTimePrice: row.one_time_price,
        currency: row.currency || "INR",
        availableOn: [
          ...(row.business_available ? (["business"] as const) : []),
          ...(row.enterprise_available ? (["enterprise"] as const) : []),
          ...(row.custom_available ? (["custom"] as const) : []),
        ],
      })),
    });
  } catch (error) {
    console.error("GET /api/billing/addons/public error:", error);
    return NextResponse.json({ success: true, addons: [] });
  }
}
