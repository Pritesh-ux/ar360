import { query } from "@/lib/db";
import { USE_CASE_CATALOG } from "@/lib/website/use-case-catalog";

let ensurePromise: Promise<void> | null = null;

/** Idempotent: ensure all Industry Use Case categories, seed models, and showcases exist. */
export async function ensureUseCaseShowcases() {
  if (!ensurePromise) {
    ensurePromise = runEnsureUseCaseShowcases().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

async function runEnsureUseCaseShowcases() {
  for (const item of USE_CASE_CATALOG) {
    await query(
      `INSERT INTO website_models (model_uid, name, file_path, folder, is_default, status)
       VALUES (?, ?, ?, ?, 0, 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [
        item.modelUid,
        `${item.name} Default`,
        `/models/use-cases/${item.slug}.glb`,
        `use-cases/${item.slug}`,
      ],
    );

    const existingCat = await query<{
      category_uid: string;
      visibility: number | boolean;
      deleted_at: Date | string | null;
    }>(
      "SELECT category_uid, visibility, deleted_at FROM website_categories WHERE slug = ? LIMIT 1",
      [item.slug],
    ).catch(async () => {
      const rows = await query<{ category_uid: string; visibility: number | boolean }>(
        "SELECT category_uid, visibility FROM website_categories WHERE slug = ? LIMIT 1",
        [item.slug],
      );
      return rows.map((r) => ({ ...r, deleted_at: null as Date | string | null }));
    });

    const categoryUid = existingCat[0]?.category_uid || item.categoryUid;
    const catDeleted = Boolean(existingCat[0]?.deleted_at);

    if (existingCat[0]) {
      // Never resurrect intentionally hidden/deleted categories; only refresh metadata.
      if (!catDeleted) {
        await query(
          `UPDATE website_categories
           SET name = ?, icon = ?, color = ?, description = ?, sort_order = ?
           WHERE category_uid = ?`,
          [item.name, item.icon, item.color, item.description, item.sortOrder, categoryUid],
        );
      }
    } else {
      await query(
        `INSERT INTO website_categories
          (category_uid, slug, name, icon, color, description, sort_order, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          categoryUid,
          item.slug,
          item.name,
          item.icon,
          item.color,
          item.description,
          item.sortOrder,
        ],
      );
    }

    if (catDeleted) continue;

    const existingSh = await query<{
      showcase_uid: string;
      glb_model_uid: string | null;
      visibility: number | boolean;
      deleted_at: Date | string | null;
    }>(
      `SELECT showcase_uid, glb_model_uid, visibility, deleted_at FROM website_showcases
       WHERE showcase_uid = ? OR (category_uid = ? AND slug = ?)
       ORDER BY CASE WHEN showcase_uid = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [item.showcaseUid, categoryUid, item.slug, item.showcaseUid],
    ).catch(async () => {
      const rows = await query<{
        showcase_uid: string;
        glb_model_uid: string | null;
        visibility: number | boolean;
      }>(
        `SELECT showcase_uid, glb_model_uid, visibility FROM website_showcases
         WHERE showcase_uid = ? OR (category_uid = ? AND slug = ?)
         ORDER BY CASE WHEN showcase_uid = ? THEN 0 ELSE 1 END
         LIMIT 1`,
        [item.showcaseUid, categoryUid, item.slug, item.showcaseUid],
      );
      return rows.map((r) => ({ ...r, deleted_at: null as Date | string | null }));
    });

    if (existingSh[0]) {
      if (existingSh[0].deleted_at) continue;

      // Preserve admin visibility/hide choices — never force visibility = 1.
      await query(
        `UPDATE website_showcases
         SET category_uid = ?, name = ?, slug = ?,
             title = COALESCE(NULLIF(title, ''), ?),
             subtitle = COALESCE(NULLIF(subtitle, ''), ?),
             description = COALESCE(NULLIF(description, ''), ?),
             cta_label = COALESCE(NULLIF(cta_label, ''), ?),
             cta_link = COALESCE(NULLIF(cta_link, ''), '/signup'),
             sort_order = ?,
             glb_model_uid = COALESCE(NULLIF(glb_model_uid, ''), ?),
             image_path = COALESCE(NULLIF(image_path, ''), ?)
         WHERE showcase_uid = ?`,
        [
          categoryUid,
          item.name,
          item.slug,
          item.title,
          item.name,
          item.description,
          item.ctaLabel,
          item.sortOrder,
          item.modelUid,
          `/home/use-cases/${item.slug}.webp`,
          existingSh[0].showcase_uid,
        ],
      ).catch(async () => {
        await query(
          `UPDATE website_showcases
           SET category_uid = ?, name = ?, slug = ?,
               title = COALESCE(NULLIF(title, ''), ?),
               subtitle = COALESCE(NULLIF(subtitle, ''), ?),
               description = COALESCE(NULLIF(description, ''), ?),
               cta_label = COALESCE(NULLIF(cta_label, ''), ?),
               cta_link = COALESCE(NULLIF(cta_link, ''), '/signup'),
               sort_order = ?,
               glb_model_uid = COALESCE(NULLIF(glb_model_uid, ''), ?)
           WHERE showcase_uid = ?`,
          [
            categoryUid,
            item.name,
            item.slug,
            item.title,
            item.name,
            item.description,
            item.ctaLabel,
            item.sortOrder,
            item.modelUid,
            existingSh[0].showcase_uid,
          ],
        );
      });
    } else {
      await query(
        `INSERT INTO website_showcases
          (showcase_uid, category_uid, name, slug, title, subtitle, description, cta_label, cta_link, glb_model_uid, image_path, sort_order, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '/signup', ?, ?, ?, 1)`,
        [
          item.showcaseUid,
          categoryUid,
          item.name,
          item.slug,
          item.title,
          item.name,
          item.description,
          item.ctaLabel,
          item.modelUid,
          `/home/use-cases/${item.slug}.webp`,
          item.sortOrder,
        ],
      ).catch(async () => {
        await query(
          `INSERT INTO website_showcases
            (showcase_uid, category_uid, name, slug, title, subtitle, description, cta_label, cta_link, glb_model_uid, sort_order, visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '/signup', ?, ?, 1)`,
          [
            item.showcaseUid,
            categoryUid,
            item.name,
            item.slug,
            item.title,
            item.name,
            item.description,
            item.ctaLabel,
            item.modelUid,
            item.sortOrder,
          ],
        );
      });
    }
  }
}
