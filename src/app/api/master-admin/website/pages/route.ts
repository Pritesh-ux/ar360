import { NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const pages = await query<any>("SELECT * FROM website_pages ORDER BY updated_at DESC");
    return NextResponse.json({ success: true, pages });
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
    const { page_uid, slug, title, content, status = "draft" } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "Slug and title are required." }, { status: 400 });
    }

    if (page_uid) {
      // Fetch current version to save snapshot in history before updating
      const current = await query<any>("SELECT * FROM website_pages WHERE page_uid = ?", [page_uid]);
      if (current.length > 0) {
        const snapshot = JSON.stringify(current[0]);
        const versionUid = `wv_${crypto.randomBytes(16).toString("hex")}`;
        await query(
          "INSERT INTO website_versions (version_uid, entity_type, entity_uid, snapshot) VALUES (?, 'page', ?, ?)",
          [versionUid, page_uid, snapshot]
        );
      }

      await query(
        "UPDATE website_pages SET slug = ?, title = ?, content = ?, status = ? WHERE page_uid = ?",
        [slug, title, content, status, page_uid]
      );

      await logAdminAudit(admin, "website.page.update", "website_page", page_uid);
      return NextResponse.json({ success: true, message: "Page updated successfully." });
    } else {
      const newUid = `wp_${crypto.randomBytes(16).toString("hex")}`;
      await query(
        "INSERT INTO website_pages (page_uid, slug, title, content, status) VALUES (?, ?, ?, ?, ?)",
        [newUid, slug, title, content, status]
      );
      await logAdminAudit(admin, "website.page.create", "website_page", newUid);
      return NextResponse.json({ success: true, page_uid: newUid, message: "Page created successfully." });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
