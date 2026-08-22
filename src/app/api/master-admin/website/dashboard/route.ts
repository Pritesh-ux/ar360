import { NextResponse } from "next/server";
import { guardAdminPermission } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const [pages, sections, assets, models, cards] = await Promise.all([
      query<{ total: number }>("SELECT COUNT(*) total FROM website_pages").then((r) => r[0]?.total || 0),
      query<{ total: number }>("SELECT COUNT(*) total FROM website_sections").then((r) => r[0]?.total || 0),
      query<{ total: number }>("SELECT COUNT(*) total FROM website_assets").then((r) => r[0]?.total || 0),
      query<{ total: number }>("SELECT COUNT(*) total FROM website_models").then((r) => r[0]?.total || 0),
      query<{ total: number }>("SELECT COUNT(*) total FROM website_cards").then((r) => r[0]?.total || 0),
    ]);

    const lastUpdatedRow = await query<{ last_update: string | null }>(`
      SELECT MAX(max_time) AS last_update FROM (
        SELECT MAX(updated_at) AS max_time FROM website_pages
        UNION ALL
        SELECT MAX(updated_at) AS max_time FROM website_sections
        UNION ALL
        SELECT MAX(updated_at) AS max_time FROM website_models
        UNION ALL
        SELECT MAX(updated_at) AS max_time FROM website_cards
      ) AS combined
    `);
    const lastUpdated = lastUpdatedRow[0]?.last_update || new Date().toISOString();

    return NextResponse.json({
      success: true,
      statistics: {
        pages,
        sections,
        assets,
        models,
        cards,
        lastUpdated,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Database query failed" }, { status: 500 });
  }
}
