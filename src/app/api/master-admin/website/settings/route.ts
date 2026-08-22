import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const settingsRows = await query<{ setting_key: string; setting_value: string | null }>(
      "SELECT setting_key, setting_value FROM website_settings"
    );
    const settings: Record<string, string> = {};
    for (const r of settingsRows) {
      settings[r.setting_key] = r.setting_value || "";
    }

    const navigation = await query<any>("SELECT * FROM website_navigation ORDER BY sort_order ASC");
    
    // Fetch page options for mapping
    const pages = await query<{ slug: string; title: string }>(
      "SELECT slug, title FROM website_pages WHERE status = 'published'"
    );

    return NextResponse.json({ success: true, settings, navigation, pageOptions: pages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const body = await req.json();
    const { settings, navigation } = body;

    // Update settings if provided
    if (settings) {
      for (const [key, val] of Object.entries(settings)) {
        await query(
          "INSERT INTO website_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
          [key, String(val ?? "")]
        );
      }
    }

    // Update navigation items if provided
    if (navigation && Array.isArray(navigation)) {
      // Clear existing first
      await query("DELETE FROM website_navigation");
      for (const item of navigation) {
        const navUid = item.nav_uid || `wn_${crypto.randomBytes(16).toString("hex")}`;
        await query(
          "INSERT INTO website_navigation (nav_uid, menu_type, label, link_url, parent_uid, sort_order, icon, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            navUid,
            item.menu_type || "navbar",
            item.label || "Link",
            item.link_url || "#",
            item.parent_uid || null,
            Number(item.sort_order || 0),
            item.icon || null,
            item.visibility === false ? 0 : 1
          ]
        );
      }
    }

    await logAdminAudit(admin, "website.settings.update", "website", "settings");
    // Landing ISR + popup copy should refresh as soon as CMS saves.
    revalidatePath("/");
    return NextResponse.json({ success: true, message: "Settings and Navigation updated successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
