import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import { ensureUseCaseShowcases } from "@/lib/website/ensure-use-case-showcases";
import {
  USE_CASE_CATALOG,
  isUploadedModelPath,
  getUseCaseFolder,
  type UseCaseCatalogItem,
} from "@/lib/website/use-case-catalog";

export const runtime = "nodejs";

type ModelRow = {
  model_uid: string;
  name: string;
  file_path: string;
  size_bytes: number;
  folder: string;
};

type ResolvedUseCase = {
  catalog: UseCaseCatalogItem;
  categoryUid: string;
  showcaseUid: string;
  modelUid: string | null;
  modelName: string | null;
  filePath: string | null;
  sizeBytes: number;
  folder: string | null;
};

async function resolveUseCase(slug: string): Promise<ResolvedUseCase | null> {
  const catalog = USE_CASE_CATALOG.find((item) => item.slug === slug);
  if (!catalog) return null;

  const rows = await query<{
    category_uid: string;
    showcase_uid: string;
    glb_model_uid: string | null;
    file_path: string | null;
    model_name: string | null;
    size_bytes: number | null;
    folder: string | null;
  }>(
    `SELECT
       c.category_uid,
       s.showcase_uid,
       s.glb_model_uid,
       m.file_path,
       m.name AS model_name,
       m.size_bytes,
       m.folder
     FROM website_categories c
     INNER JOIN website_showcases s ON s.category_uid = c.category_uid
     LEFT JOIN website_models m ON s.glb_model_uid = m.model_uid
     WHERE c.slug = ?
     ORDER BY s.sort_order ASC, s.id ASC
     LIMIT 1`,
    [slug],
  );

  const row = rows[0];
  return {
    catalog,
    categoryUid: row?.category_uid || catalog.categoryUid,
    showcaseUid: row?.showcase_uid || catalog.showcaseUid,
    modelUid: row?.glb_model_uid || null,
    modelName: row?.model_name || null,
    filePath: row?.file_path || null,
    sizeBytes: Number(row?.size_bytes || 0),
    folder: row?.folder || null,
  };
}

async function listUseCaseModels() {
  await ensureUseCaseShowcases();
  const items = [];
  for (const catalog of USE_CASE_CATALOG) {
    const resolved = await resolveUseCase(catalog.slug);
    if (!resolved) continue;
    const filePath = resolved.filePath;
    const hasUpload = isUploadedModelPath(filePath);
    const isSeedPath = Boolean(filePath?.startsWith("/models/use-cases/"));
    items.push({
      slug: catalog.slug,
      name: catalog.name,
      title: catalog.title,
      categoryUid: resolved.categoryUid,
      showcaseUid: resolved.showcaseUid,
      modelUid: resolved.modelUid || catalog.modelUid,
      modelName: resolved.modelName,
      filePath,
      sizeBytes: resolved.sizeBytes,
      folder: resolved.folder || getUseCaseFolder(catalog.slug),
      hasCustomUpload: hasUpload,
      isActive: hasUpload || (Boolean(filePath) && !isSeedPath),
    });
  }
  return items;
}

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await listUseCaseModels();
    return NextResponse.json({ success: true, items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load use-case models.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    await ensureUseCaseShowcases();
    const data = await req.formData();
    const slug = String(data.get("slug") || "").trim().toLowerCase();
    const file = data.get("file") as File | null;
    const resolved = await resolveUseCase(slug);

    if (!resolved) {
      return NextResponse.json({ error: "Unknown use-case category." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "No GLB file uploaded." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".glb")) {
      return NextResponse.json({ error: "Only .glb files are allowed." }, { status: 400 });
    }

    const previousUid = resolved.modelUid;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), "public", "uploads", "models");
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${slug}-${crypto.randomBytes(12).toString("hex")}.glb`;
    const absolutePath = path.join(uploadDir, filename);
    await fs.writeFile(absolutePath, buffer);
    const relativePath = `/uploads/models/${filename}`;
    const newUid = `wm_${crypto.randomBytes(12).toString("hex")}`;
    const folder = getUseCaseFolder(slug);

    await query(
      `INSERT INTO website_models
        (model_uid, name, file_path, size_bytes, polygon_count, folder, is_default, status)
       VALUES (?, ?, ?, ?, 0, ?, 0, 'active')`,
      [newUid, `${resolved.catalog.name} — ${file.name}`, relativePath, file.size, folder],
    );

    await query(
      "UPDATE website_showcases SET glb_model_uid = ? WHERE showcase_uid = ?",
      [newUid, resolved.showcaseUid],
    );

    if (previousUid && previousUid !== newUid && previousUid !== resolved.catalog.modelUid) {
      await maybeDeleteOrphanUpload(previousUid);
    }

    await logAdminAudit(admin, "website.use_case_model.upload", "website_showcase", resolved.showcaseUid, {
      slug,
      modelUid: newUid,
    });

    const items = await listUseCaseModels();
    return NextResponse.json({
      success: true,
      model_uid: newUid,
      file_path: relativePath,
      items,
      message: `${resolved.catalog.name} GLB uploaded.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await guardAdminPermission("settings.manage");
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  try {
    await ensureUseCaseShowcases();
    const url = new URL(req.url);
    const slug = String(url.searchParams.get("slug") || "").trim().toLowerCase();
    const resolved = await resolveUseCase(slug);

    if (!resolved) {
      return NextResponse.json({ error: "Unknown use-case category." }, { status: 400 });
    }

    const currentUid = resolved.modelUid;
    await query(
      "UPDATE website_showcases SET glb_model_uid = ? WHERE showcase_uid = ?",
      [resolved.catalog.modelUid, resolved.showcaseUid],
    );

    if (currentUid && currentUid !== resolved.catalog.modelUid) {
      await maybeDeleteOrphanUpload(currentUid);
    }

    await logAdminAudit(admin, "website.use_case_model.remove", "website_showcase", resolved.showcaseUid, {
      slug,
    });

    const items = await listUseCaseModels();
    return NextResponse.json({
      success: true,
      items,
      message: `${resolved.catalog.name} custom GLB removed.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Remove failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function maybeDeleteOrphanUpload(modelUid: string) {
  const models = await query<ModelRow>(
    "SELECT model_uid, name, file_path, size_bytes, folder FROM website_models WHERE model_uid = ? LIMIT 1",
    [modelUid],
  );
  const model = models[0];
  if (!model || !isUploadedModelPath(model.file_path)) return;

  const stillUsed = await query<{ total: number }>(
    `SELECT (
       (SELECT COUNT(*) FROM website_showcases WHERE glb_model_uid = ?)
       + (SELECT COUNT(*) FROM website_sections WHERE glb_model_uid = ?)
     ) AS total`,
    [modelUid, modelUid],
  );
  if ((stillUsed[0]?.total || 0) > 0) return;

  const physicalPath = path.join(process.cwd(), "public", model.file_path.replace(/^\//, ""));
  await fs.unlink(physicalPath).catch(() => undefined);
  await query("DELETE FROM website_models WHERE model_uid = ?", [modelUid]);
}
