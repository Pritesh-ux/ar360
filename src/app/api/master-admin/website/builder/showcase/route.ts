import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardAdminPermission, logAdminAudit } from "@/lib/permissions/admin-rbac";
import { query } from "@/lib/db";
import crypto from "crypto";
import { isSafeLandingUrl, isSafeMediaPath, sanitizeStyleSettings } from "@/lib/website/landing-editor.validation";

export const runtime = "nodejs";

function parseBenefits(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((b) => String(b).slice(0, 200)).slice(0, 12);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((b) => String(b).slice(0, 200)).slice(0, 12);
    } catch {
      return raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  }
  return [];
}

export async function GET() {
  const auth = await guardAdminPermission("settings.read");
  if (auth instanceof NextResponse) return auth;

  try {
    const [categories, showcases] = await Promise.all([
      query<any>("SELECT * FROM website_categories ORDER BY sort_order ASC"),
      query<any>("SELECT * FROM website_showcases ORDER BY sort_order ASC"),
    ]);

    return NextResponse.json({
      success: true,
      categories,
      showcases: showcases.map((s: any) => ({
        ...s,
        benefits: parseBenefits(s.benefits),
        style_settings: sanitizeStyleSettings(
          typeof s.style_settings === "string" ? JSON.parse(s.style_settings) : s.style_settings,
        ),
      })),
    });
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
    const { action, type, ...payload } = body;

    if (action === "reorder" && type === "showcase" && Array.isArray(payload.ordered_uids)) {
      for (let i = 0; i < payload.ordered_uids.length; i++) {
        await query("UPDATE website_showcases SET sort_order = ? WHERE showcase_uid = ?", [
          i,
          payload.ordered_uids[i],
        ]);
      }
      await logAdminAudit(admin, "website.showcase.reorder", "website_showcase", "batch");
      revalidatePath("/");
      return NextResponse.json({ success: true, message: "Reordered." });
    }

    if (action === "restore") {
      if (type === "category") {
        await query(
          "UPDATE website_categories SET deleted_at = NULL, visibility = 1 WHERE category_uid = ?",
          [payload.category_uid],
        ).catch(async () =>
          query("UPDATE website_categories SET visibility = 1 WHERE category_uid = ?", [
            payload.category_uid,
          ]),
        );
      } else {
        await query(
          "UPDATE website_showcases SET deleted_at = NULL, visibility = 1 WHERE showcase_uid = ?",
          [payload.showcase_uid],
        ).catch(async () =>
          query("UPDATE website_showcases SET visibility = 1 WHERE showcase_uid = ?", [
            payload.showcase_uid,
          ]),
        );
      }
      await logAdminAudit(admin, "website.showcase.restore", "website_showcase", payload.category_uid || payload.showcase_uid);
      revalidatePath("/");
      return NextResponse.json({ success: true, message: "Restored." });
    }

    if (action === "delete") {
      if (type === "category") {
        await query(
          "UPDATE website_categories SET deleted_at = NOW(), visibility = 0 WHERE category_uid = ?",
          [payload.category_uid],
        ).catch(async () =>
          query("UPDATE website_categories SET visibility = 0 WHERE category_uid = ?", [
            payload.category_uid,
          ]),
        );
      } else {
        await query(
          "UPDATE website_showcases SET deleted_at = NOW(), visibility = 0 WHERE showcase_uid = ?",
          [payload.showcase_uid],
        ).catch(async () =>
          query("UPDATE website_showcases SET visibility = 0 WHERE showcase_uid = ?", [
            payload.showcase_uid,
          ]),
        );
      }
      await logAdminAudit(admin, "website.showcase.delete", "website_showcase", payload.category_uid || payload.showcase_uid, {
        type,
        soft: true,
      });
      revalidatePath("/");
      return NextResponse.json({ success: true, message: "Deleted successfully." });
    }

    if (type === "category") {
      const { category_uid, name, slug, icon, color, description, sort_order, visibility } = payload;
      if (category_uid) {
        await query(
          `UPDATE website_categories SET 
            name = ?, 
            slug = ?, 
            icon = ?, 
            color = ?, 
            description = ?, 
            sort_order = ?, 
            visibility = ? 
          WHERE category_uid = ?`,
          [name, slug, icon, color, description, Number(sort_order || 0), visibility ? 1 : 0, category_uid],
        );
      } else {
        const newUid = `cat_${crypto.randomBytes(16).toString("hex")}`;
        await query(
          "INSERT INTO website_categories (category_uid, slug, name, icon, color, description, sort_order, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [newUid, slug, name, icon, color, description, Number(sort_order || 0), visibility ? 1 : 0],
        );
      }
      await logAdminAudit(admin, "website.category.save", "website_category", category_uid || null);
      revalidatePath("/");
      return NextResponse.json({ success: true, message: "Category saved successfully." });
    }

    const {
      showcase_uid,
      category_uid,
      name,
      slug,
      title,
      subtitle,
      description,
      cta_label,
      cta_link,
      glb_model_uid,
      glb_settings,
      image_path,
      benefits,
      style_settings,
      sort_order,
      visibility,
    } = payload;

    if (cta_link && !isSafeLandingUrl(String(cta_link))) {
      return NextResponse.json({ error: "Unsafe CTA link" }, { status: 400 });
    }
    if (image_path && !isSafeMediaPath(String(image_path))) {
      return NextResponse.json({ error: "Unsafe image path" }, { status: 400 });
    }

    const benefitsJson = JSON.stringify(parseBenefits(benefits));
    const styleJson = JSON.stringify(sanitizeStyleSettings(style_settings));

    if (showcase_uid) {
      await query(
        `UPDATE website_showcases SET 
          category_uid = ?, 
          name = ?, 
          slug = ?, 
          title = ?, 
          subtitle = ?, 
          description = ?, 
          cta_label = ?, 
          cta_link = ?, 
          glb_model_uid = ?, 
          glb_settings = ?,
          image_path = ?,
          benefits = ?,
          style_settings = ?,
          sort_order = ?, 
          visibility = ? 
        WHERE showcase_uid = ?`,
        [
          category_uid,
          name,
          slug,
          title,
          subtitle,
          description,
          cta_label,
          cta_link,
          glb_model_uid || null,
          glb_settings ? JSON.stringify(glb_settings) : null,
          image_path || null,
          benefitsJson,
          styleJson,
          Number(sort_order || 0),
          visibility ? 1 : 0,
          showcase_uid,
        ],
      ).catch(async () => {
        await query(
          `UPDATE website_showcases SET 
            category_uid = ?, name = ?, slug = ?, title = ?, subtitle = ?, description = ?,
            cta_label = ?, cta_link = ?, glb_model_uid = ?, glb_settings = ?,
            sort_order = ?, visibility = ?
          WHERE showcase_uid = ?`,
          [
            category_uid,
            name,
            slug,
            title,
            subtitle,
            description,
            cta_label,
            cta_link,
            glb_model_uid || null,
            glb_settings ? JSON.stringify(glb_settings) : null,
            Number(sort_order || 0),
            visibility ? 1 : 0,
            showcase_uid,
          ],
        );
      });
    } else {
      const newUid = `sh_${crypto.randomBytes(16).toString("hex")}`;
      await query(
        `INSERT INTO website_showcases
          (showcase_uid, category_uid, name, slug, title, subtitle, description, cta_label, cta_link,
           glb_model_uid, glb_settings, image_path, benefits, style_settings, sort_order, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newUid,
          category_uid,
          name,
          slug,
          title,
          subtitle,
          description,
          cta_label,
          cta_link,
          glb_model_uid || null,
          glb_settings ? JSON.stringify(glb_settings) : null,
          image_path || null,
          benefitsJson,
          styleJson,
          Number(sort_order || 0),
          visibility ? 1 : 0,
        ],
      ).catch(async () => {
        await query(
          `INSERT INTO website_showcases
            (showcase_uid, category_uid, name, slug, title, subtitle, description, cta_label, cta_link,
             glb_model_uid, glb_settings, sort_order, visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newUid,
            category_uid,
            name,
            slug,
            title,
            subtitle,
            description,
            cta_label,
            cta_link,
            glb_model_uid || null,
            glb_settings ? JSON.stringify(glb_settings) : null,
            Number(sort_order || 0),
            visibility ? 1 : 0,
          ],
        );
      });
    }
    await logAdminAudit(admin, "website.showcase.save", "website_showcase", showcase_uid || null);
    revalidatePath("/");
    return NextResponse.json({ success: true, message: "Showcase item saved successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
