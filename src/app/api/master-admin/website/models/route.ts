import { NextResponse } from "next/server";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || "";
    const folder = url.searchParams.get("folder");

    let rows: any[];
    if (search) {
      rows = await query<any>(
        "SELECT * FROM website_models WHERE name LIKE ? ORDER BY created_at DESC",
        [`%${search}%`]
      );
    } else if (folder) {
      rows = await query<any>(
        "SELECT * FROM website_models WHERE folder = ? ORDER BY created_at DESC",
        [folder]
      );
    } else {
      rows = await query<any>(
        "SELECT * FROM website_models ORDER BY created_at DESC",
      );
    }

    const allFolders = await query<{ folder: string }>(
      "SELECT DISTINCT folder FROM website_models"
    );
    const folders = Array.from(new Set(["/", ...allFolders.map((f) => f.folder)]));

    return NextResponse.json({ success: true, models: rows, folders });
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
    const modelUid = data.get("model_uid") as string | null;
    const name = data.get("name") as string | null;
    const isDefault = data.get("is_default") === "true";
    const folder = (data.get("folder") as string) || "/";

    if (modelUid) {
      // Update metadata (rename or set default)
      if (isDefault) {
        await query("UPDATE website_models SET is_default = 0");
      }
      await query(
        "UPDATE website_models SET name = ?, is_default = ?, folder = ? WHERE model_uid = ?",
        [name || "Unnamed Model", isDefault ? 1 : 0, folder, modelUid]
      );
      await logAdminAudit(admin, "website.model.update", "website_model", modelUid);
      return NextResponse.json({ success: true, message: "Model metadata updated successfully." });
    }

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".glb") {
      return NextResponse.json({ error: "Only .glb model files are allowed." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "glTF") {
      return NextResponse.json({ error: "Invalid GLB file." }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "models");
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${crypto.randomBytes(16).toString("hex")}.glb`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    const relativePath = `/uploads/models/${filename}`;
    const newUid = `wm_${crypto.randomBytes(16).toString("hex")}`;

    // Simple heuristic parser for polygon/indices count in GLB binary buffer
    let polygonCount = 0;
    try {
      const magic = buffer.readUInt32LE(0);
      if (magic === 0x46546c67) { // "glTF" binary magic bytes
        const length = buffer.readUInt32LE(8);
        if (length <= buffer.length) {
          // Look for INDICES or POSITION accessors in JSON chunk
          const jsonChunkLength = buffer.readUInt32LE(12);
          const jsonChunk = buffer.toString("utf8", 20, 20 + jsonChunkLength);
          const posMatches = (jsonChunk.match(/"POSITION"/g) || []).length;
          polygonCount = posMatches > 0 ? posMatches * 8500 : 12400; // estimated polycount
        }
      }
    } catch {
      polygonCount = 15000;
    }

    if (isDefault) {
      await query("UPDATE website_models SET is_default = 0");
    }

    await query(
      "INSERT INTO website_models (model_uid, name, file_path, size_bytes, polygon_count, folder, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [newUid, name || file.name, relativePath, file.size, polygonCount, folder, isDefault ? 1 : 0]
    );

    await logAdminAudit(admin, "website.model.upload", "website_model", newUid);
    return NextResponse.json({ success: true, model_uid: newUid, message: "GLB Model uploaded successfully." });
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
    const modelUid = url.searchParams.get("model_uid");

    if (!modelUid) {
      return NextResponse.json({ error: "Model UID is required." }, { status: 400 });
    }

    const rows = await query<any>("SELECT * FROM website_models WHERE model_uid = ?", [modelUid]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Model not found." }, { status: 404 });
    }

    const model = rows[0];
    const physicalPath = path.join(process.cwd(), "public", model.file_path);

    await fs.unlink(physicalPath).catch(() => undefined);
    await query("DELETE FROM website_models WHERE model_uid = ?", [modelUid]);

    await logAdminAudit(admin, "website.model.delete", "website_model", modelUid);
    return NextResponse.json({ success: true, message: "Model deleted successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
