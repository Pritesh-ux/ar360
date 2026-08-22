import { NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

function safeFolder(raw: string) {
  const cleaned = String(raw || "/")
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .slice(0, 100);
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

export async function GET(req: Request) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const folder = safeFolder(url.searchParams.get("folder") || "/");

    let rows: any[];
    if (search) {
      rows = await query<any>(
        "SELECT * FROM website_assets WHERE name LIKE ? ORDER BY created_at DESC LIMIT 200",
        [`%${search.slice(0, 80)}%`],
      );
    } else {
      rows = await query<any>(
        "SELECT * FROM website_assets WHERE folder = ? ORDER BY created_at DESC LIMIT 200",
        [folder],
      );
    }

    const allFolders = await query<{ folder: string }>("SELECT DISTINCT folder FROM website_assets");
    const folders = Array.from(new Set(["/", ...allFolders.map((f) => f.folder)]));

    return NextResponse.json({ success: true, assets: rows, folders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const data = await req.formData();
    const file = data.get("file") as File | null;
    const folder = safeFolder((data.get("folder") as string) || "/");

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "Only PNG, JPEG, WebP, AVIF, or GIF images are allowed." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 8MB limit." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads", "assets");
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name).toLowerCase() || ".png";
    const allowedExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);
    if (!allowedExt.has(ext)) {
      return NextResponse.json({ error: "Unsupported file extension." }, { status: 400 });
    }

    const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const relativePath = `/uploads/assets/${filename}`;
    const assetUid = `wa_${crypto.randomBytes(16).toString("hex")}`;

    await query(
      "INSERT INTO website_assets (asset_uid, name, file_path, mime_type, size_bytes, folder) VALUES (?, ?, ?, ?, ?, ?)",
      [assetUid, file.name.slice(0, 255), relativePath, file.type, file.size, folder],
    );

    await logAdminAudit(admin, "website.asset.upload", "website_asset", assetUid);
    return NextResponse.json({ success: true, relativePath, assetUid, message: "Asset uploaded successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    const url = new URL(req.url);
    const assetUid = url.searchParams.get("asset_uid");

    if (!assetUid) {
      return NextResponse.json({ error: "Asset UID is required." }, { status: 400 });
    }

    const assetRows = await query<any>("SELECT * FROM website_assets WHERE asset_uid = ?", [assetUid]);
    if (assetRows.length === 0) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const asset = assetRows[0];

    // Reference-aware delete: refuse if still referenced by showcases/cards/settings.
    const refs = await query<{ total: number }>(
      `SELECT
         (SELECT COUNT(*) FROM website_showcases WHERE image_path = ?) +
         (SELECT COUNT(*) FROM website_cards WHERE image_path = ?) +
         (SELECT COUNT(*) FROM website_settings WHERE setting_value = ?) AS total`,
      [asset.file_path, asset.file_path, asset.file_path],
    ).catch(() => [{ total: 0 }]);

    if (Number(refs[0]?.total || 0) > 0) {
      return NextResponse.json(
        { error: "Asset is still referenced by landing content. Remove references first." },
        { status: 409 },
      );
    }

    const physicalPath = path.join(process.cwd(), "public", asset.file_path.replace(/^\//, ""));
    await fs.unlink(physicalPath).catch(() => undefined);
    await query("DELETE FROM website_assets WHERE asset_uid = ?", [assetUid]);

    await logAdminAudit(admin, "website.asset.delete", "website_asset", assetUid);
    return NextResponse.json({ success: true, message: "Asset deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
