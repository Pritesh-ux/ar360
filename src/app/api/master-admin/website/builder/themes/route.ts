import { NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const themes = await query<any>("SELECT * FROM website_themes ORDER BY created_at DESC");
    return NextResponse.json({ success: true, themes });
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
    const { action, theme_uid, name, tokens } = body;

    if (action === "apply") {
      if (!theme_uid) {
        return NextResponse.json({ error: "Theme UID is required." }, { status: 400 });
      }
      // Set all themes inactive first
      await query("UPDATE website_themes SET is_active = 0");
      // Set selected theme active
      await query("UPDATE website_themes SET is_active = 1 WHERE theme_uid = ?", [theme_uid]);

      // Pull tokens of the applied theme to cache in general settings if needed
      const themeRow = await query<any>("SELECT tokens FROM website_themes WHERE theme_uid = ?", [theme_uid]);
      if (themeRow.length > 0) {
        const themeTokens = typeof themeRow[0].tokens === "string" ? JSON.parse(themeRow[0].tokens) : themeRow[0].tokens;
        // Save current active theme configurations in settings
        for (const [key, value] of Object.entries(themeTokens)) {
          await query(
            "INSERT INTO website_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
            [`theme_${key}`, String(value ?? "")]
          );
        }
      }

      await logAdminAudit(admin, "website.theme.apply", "website_theme", theme_uid);
      return NextResponse.json({ success: true, message: "Theme applied successfully." });
    }

    if (theme_uid) {
      // Update existing
      await query(
        "UPDATE website_themes SET name = ?, tokens = ? WHERE theme_uid = ?",
        [name || "Custom Theme", JSON.stringify(tokens || {}), theme_uid]
      );
      await logAdminAudit(admin, "website.theme.update", "website_theme", theme_uid);
      return NextResponse.json({ success: true, message: "Theme updated successfully." });
    } else {
      // Create new
      const newUid = `th_${crypto.randomBytes(16).toString("hex")}`;
      await query(
        "INSERT INTO website_themes (theme_uid, name, tokens, is_active) VALUES (?, ?, ?, 0)",
        [newUid, name || "New Theme", JSON.stringify(tokens || {})]
      );
      await logAdminAudit(admin, "website.theme.create", "website_theme", newUid);
      return NextResponse.json({ success: true, theme_uid: newUid, message: "Theme created successfully." });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
