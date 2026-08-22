import { NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: pageUid } = await params;
    const pageRows = await query<any>("SELECT * FROM website_pages WHERE page_uid = ?", [pageUid]);
    if (pageRows.length === 0) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const versions = await query<any>(
      "SELECT version_uid, created_at FROM website_versions WHERE entity_type = 'page' AND entity_uid = ? ORDER BY created_at DESC",
      [pageUid]
    );

    return NextResponse.json({ success: true, page: pageRows[0], versions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const { id: pageUid } = await params;
    const body = await req.json();
    const { version_uid } = body;

    if (!version_uid) {
      return NextResponse.json({ error: "Version UID is required for restoration." }, { status: 400 });
    }

    const versionRows = await query<any>(
      "SELECT * FROM website_versions WHERE version_uid = ? AND entity_uid = ?",
      [version_uid, pageUid]
    );
    if (versionRows.length === 0) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    const snapshot = JSON.parse(versionRows[0].snapshot);

    // Save current state into version history before restoring
    const currentRows = await query<any>("SELECT * FROM website_pages WHERE page_uid = ?", [pageUid]);
    if (currentRows.length > 0) {
      const currentSnapshot = JSON.stringify(currentRows[0]);
      const nextVersionUid = `wv_${crypto.randomBytes(16).toString("hex")}`;
      await query(
        "INSERT INTO website_versions (version_uid, entity_type, entity_uid, snapshot) VALUES (?, 'page', ?, ?)",
        [nextVersionUid, pageUid, currentSnapshot]
      );
    }

    // Restore from snapshot
    await query(
      "UPDATE website_pages SET slug = ?, title = ?, content = ?, status = ? WHERE page_uid = ?",
      [snapshot.slug, snapshot.title, snapshot.content, snapshot.status, pageUid]
    );

    await logAdminAudit(admin, "website.page.restore", "website_page", pageUid, { version_uid });
    return NextResponse.json({ success: true, message: "Page version restored successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
