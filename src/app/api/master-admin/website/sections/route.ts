import { NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const sections = await query<any>("SELECT * FROM website_sections ORDER BY sort_order ASC");
    return NextResponse.json({ success: true, sections });
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
    const { section_uid, title, subtitle, description, buttons, background, visibility, sort_order, glb_model_uid, glb_settings } = body;

    if (!section_uid) {
      return NextResponse.json({ error: "Section UID is required." }, { status: 400 });
    }

    // Save history snapshot of current state before updating
    const current = await query<any>("SELECT * FROM website_sections WHERE section_uid = ?", [section_uid]);
    if (current.length > 0) {
      const snapshot = JSON.stringify(current[0]);
      const versionUid = `wv_${crypto.randomBytes(16).toString("hex")}`;
      await query(
        "INSERT INTO website_versions (version_uid, entity_type, entity_uid, snapshot) VALUES (?, 'section', ?, ?)",
        [versionUid, section_uid, snapshot]
      );
    }

    await query(
      `UPDATE website_sections SET 
        title = ?, 
        subtitle = ?, 
        description = ?, 
        buttons = ?, 
        background = ?, 
        visibility = ?, 
        sort_order = ?, 
        glb_model_uid = ?, 
        glb_settings = ? 
      WHERE section_uid = ?`,
      [
        title,
        subtitle,
        description,
        buttons ? JSON.stringify(buttons) : null,
        background,
        visibility ? 1 : 0,
        Number(sort_order || 0),
        glb_model_uid || null,
        glb_settings ? JSON.stringify(glb_settings) : null,
        section_uid
      ]
    );

    await logAdminAudit(admin, "website.section.update", "website_section", section_uid);
    return NextResponse.json({ success: true, message: "Section updated successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
