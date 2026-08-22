import crypto from "crypto";
import { getPool, query } from "@/lib/db";
import { ensureLandingEditorSchema } from "@/lib/website/landing-editor.schema";
import {
  type LandingCardDoc,
  type LandingCategoryDoc,
  type LandingDraftMeta,
  type LandingEditorDocument,
  type LandingNavItem,
  type LandingSectionDoc,
  type LandingShowcaseDoc,
} from "@/lib/website/landing-editor.types";
import {
  LandingEditorValidationError,
  sanitizeStyleSettings,
  validateLandingDocument,
} from "@/lib/website/landing-editor.validation";

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asBool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export async function assembleLandingDocument(): Promise<LandingEditorDocument> {
  await ensureLandingEditorSchema();

  const [settingsRows, navigation, sections, cards, categories, showcases] = await Promise.all([
    query<{ setting_key: string; setting_value: string | null }>(
      "SELECT setting_key, setting_value FROM website_settings",
    ),
    query<any>("SELECT * FROM website_navigation ORDER BY sort_order ASC"),
    query<any>("SELECT * FROM website_sections ORDER BY sort_order ASC"),
    query<any>("SELECT * FROM website_cards ORDER BY sort_order ASC"),
    query<any>(
      "SELECT * FROM website_categories WHERE deleted_at IS NULL ORDER BY sort_order ASC",
    ).catch(async () => query<any>("SELECT * FROM website_categories ORDER BY sort_order ASC")),
    query<any>(
      "SELECT * FROM website_showcases WHERE deleted_at IS NULL ORDER BY sort_order ASC",
    ).catch(async () => query<any>("SELECT * FROM website_showcases ORDER BY sort_order ASC")),
  ]);

  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.setting_key] = row.setting_value || "";

  const navDocs: LandingNavItem[] = navigation.map((row: any) => ({
    nav_uid: row.nav_uid,
    menu_type: row.menu_type === "footer" ? "footer" : "navbar",
    label: row.label || "",
    link_url: row.link_url || "#",
    parent_uid: row.parent_uid || null,
    sort_order: Number(row.sort_order || 0),
    icon: row.icon || null,
    visibility: asBool(row.visibility),
  }));

  const sectionDocs: LandingSectionDoc[] = sections.map((row: any) => ({
    section_uid: row.section_uid,
    page_uid: row.page_uid || "wp_home",
    section_key: row.section_key,
    title: row.title || "",
    subtitle: row.subtitle || "",
    description: row.description || "",
    buttons: parseJson(row.buttons, []),
    images: parseJson(row.images, []),
    background: row.background || "bg-white",
    visibility: asBool(row.visibility),
    sort_order: Number(row.sort_order || 0),
    glb_model_uid: row.glb_model_uid || null,
    glb_settings: parseJson(row.glb_settings, {}),
    style_settings: sanitizeStyleSettings(parseJson(row.style_settings, {})),
  }));

  const cardDocs: LandingCardDoc[] = cards.map((row: any) => ({
    card_uid: row.card_uid,
    section_uid: row.section_uid,
    title: row.title || "",
    description: row.description || "",
    image_path: row.image_path || null,
    glb_path: row.glb_path || null,
    button_label: row.button_label || null,
    button_link: row.button_link || null,
    features: parseJson(row.features, []),
    sort_order: Number(row.sort_order || 0),
    visibility: asBool(row.visibility),
    style_settings: sanitizeStyleSettings(parseJson(row.style_settings, {})),
  }));

  const categoryDocs: LandingCategoryDoc[] = categories.map((row: any) => ({
    category_uid: row.category_uid,
    slug: row.slug,
    name: row.name || "",
    icon: row.icon || null,
    color: row.color || null,
    description: row.description || "",
    sort_order: Number(row.sort_order || 0),
    visibility: asBool(row.visibility),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  }));

  const showcaseDocs: LandingShowcaseDoc[] = showcases.map((row: any) => ({
    showcase_uid: row.showcase_uid,
    category_uid: row.category_uid,
    name: row.name || "",
    slug: row.slug || "",
    title: row.title || "",
    subtitle: row.subtitle || "",
    description: row.description || "",
    cta_label: row.cta_label || "Get Started",
    cta_link: row.cta_link || "/signup",
    glb_model_uid: row.glb_model_uid || null,
    glb_settings: parseJson(row.glb_settings, {}),
    image_path: row.image_path || null,
    benefits: parseJson(row.benefits, []),
    style_settings: sanitizeStyleSettings(parseJson(row.style_settings, {})),
    sort_order: Number(row.sort_order || 0),
    visibility: asBool(row.visibility),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  }));

  return validateLandingDocument({
    version: 1,
    settings,
    navigation: navDocs,
    sections: sectionDocs,
    cards: cardDocs,
    categories: categoryDocs,
    showcases: showcaseDocs,
  });
}

async function readDraftRow() {
  await ensureLandingEditorSchema();
  const rows = await query<{
    document_json: string;
    revision: number;
    status: "draft" | "published";
    updated_at: Date | string | null;
    published_at: Date | string | null;
  }>("SELECT document_json, revision, status, updated_at, published_at FROM website_landing_drafts WHERE id = 1 LIMIT 1");
  return rows[0] || null;
}

export async function getLandingEditorState(): Promise<{
  document: LandingEditorDocument;
  meta: LandingDraftMeta;
}> {
  const published = await assembleLandingDocument();
  const draft = await readDraftRow();

  if (!draft) {
    return {
      document: published,
      meta: {
        revision: 1,
        status: "published",
        updated_at: null,
        published_at: null,
        dirty: false,
      },
    };
  }

  let document: LandingEditorDocument;
  try {
    document = validateLandingDocument(JSON.parse(draft.document_json));
  } catch {
    document = published;
  }

  const dirty = JSON.stringify(document) !== JSON.stringify(published);
  return {
    document,
    meta: {
      revision: Number(draft.revision || 1),
      status: draft.status,
      updated_at: draft.updated_at ? String(draft.updated_at) : null,
      published_at: draft.published_at ? String(draft.published_at) : null,
      dirty,
    },
  };
}

export async function getDraftOrPublishedDocument(preferDraft: boolean): Promise<LandingEditorDocument> {
  if (!preferDraft) return assembleLandingDocument();
  const state = await getLandingEditorState();
  return state.document;
}

export async function saveLandingDraft(input: {
  document: unknown;
  expectedRevision: number;
  adminId?: number | null;
}): Promise<{ revision: number; document: LandingEditorDocument }> {
  await ensureLandingEditorSchema();
  const document = validateLandingDocument(input.document);
  const current = await readDraftRow();
  const currentRevision = current ? Number(current.revision) : 1;

  if (current && Number(input.expectedRevision) !== currentRevision) {
    throw new LandingEditorValidationError(
      `Draft revision conflict (expected ${input.expectedRevision}, found ${currentRevision})`,
    );
  }

  const nextRevision = current ? currentRevision + 1 : 1;
  const json = JSON.stringify(document);

  if (current) {
    await query(
      `UPDATE website_landing_drafts
       SET document_json = ?, revision = ?, status = 'draft', updated_by = ?
       WHERE id = 1 AND revision = ?`,
      [json, nextRevision, input.adminId ?? null, currentRevision],
    );
  } else {
    await query(
      `INSERT INTO website_landing_drafts (id, document_json, revision, status, updated_by)
       VALUES (1, ?, ?, 'draft', ?)`,
      [json, nextRevision, input.adminId ?? null],
    );
  }

  return { revision: nextRevision, document };
}

async function snapshotPublished(document: LandingEditorDocument) {
  const versionUid = `wv_${crypto.randomBytes(12).toString("hex")}`;
  await query(
    `INSERT INTO website_versions (version_uid, entity_type, entity_uid, snapshot)
     VALUES (?, 'landing', 'home', ?)`,
    [versionUid, JSON.stringify({ at: new Date().toISOString(), document })],
  );
  return versionUid;
}

export async function publishLandingDocument(input: {
  document?: unknown;
  expectedRevision: number;
  adminId?: number | null;
}): Promise<{ revision: number; versionUid: string; document: LandingEditorDocument }> {
  await ensureLandingEditorSchema();

  let document: LandingEditorDocument;
  if (input.document) {
    document = validateLandingDocument(input.document);
  } else {
    const state = await getLandingEditorState();
    if (Number(input.expectedRevision) !== state.meta.revision) {
      throw new LandingEditorValidationError(
        `Draft revision conflict (expected ${input.expectedRevision}, found ${state.meta.revision})`,
      );
    }
    document = state.document;
  }

  const previous = await assembleLandingDocument();
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Settings upsert
    for (const [key, val] of Object.entries(document.settings)) {
      await connection.query(
        `INSERT INTO website_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, val],
      );
    }

    await connection.query("DELETE FROM website_navigation");
    for (const item of document.navigation) {
      await connection.query(
        `INSERT INTO website_navigation
          (nav_uid, menu_type, label, link_url, parent_uid, sort_order, icon, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.nav_uid,
          item.menu_type,
          item.label,
          item.link_url,
          item.parent_uid,
          item.sort_order,
          item.icon,
          item.visibility ? 1 : 0,
        ],
      );
    }

    for (const section of document.sections) {
      await connection.query(
        `UPDATE website_sections SET
          title = ?, subtitle = ?, description = ?, buttons = ?, images = ?,
          background = ?, visibility = ?, sort_order = ?, glb_model_uid = ?,
          glb_settings = ?, style_settings = ?
         WHERE section_uid = ?`,
        [
          section.title,
          section.subtitle,
          section.description,
          JSON.stringify(section.buttons),
          JSON.stringify(section.images),
          section.background,
          section.visibility ? 1 : 0,
          section.sort_order,
          section.glb_model_uid,
          JSON.stringify(section.glb_settings || {}),
          JSON.stringify(section.style_settings || {}),
          section.section_uid,
        ],
      );
    }

    for (const card of document.cards) {
      await connection.query(
        `UPDATE website_cards SET
          title = ?, description = ?, image_path = ?, glb_path = ?,
          button_label = ?, button_link = ?, features = ?, sort_order = ?,
          visibility = ?, style_settings = ?
         WHERE card_uid = ?`,
        [
          card.title,
          card.description,
          card.image_path,
          card.glb_path,
          card.button_label,
          card.button_link,
          JSON.stringify(card.features || []),
          card.sort_order,
          card.visibility ? 1 : 0,
          JSON.stringify(card.style_settings || {}),
          card.card_uid,
        ],
      );
    }

    for (const category of document.categories) {
      await connection.query(
        `INSERT INTO website_categories
          (category_uid, slug, name, icon, color, description, sort_order, visibility, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          slug = VALUES(slug), name = VALUES(name), icon = VALUES(icon), color = VALUES(color),
          description = VALUES(description), sort_order = VALUES(sort_order),
          visibility = VALUES(visibility), deleted_at = VALUES(deleted_at)`,
        [
          category.category_uid,
          category.slug,
          category.name,
          category.icon,
          category.color,
          category.description,
          category.sort_order,
          category.visibility ? 1 : 0,
          category.deleted_at,
        ],
      ).catch(async () => {
        // Older schema without deleted_at
        await connection.query(
          `INSERT INTO website_categories
            (category_uid, slug, name, icon, color, description, sort_order, visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            slug = VALUES(slug), name = VALUES(name), icon = VALUES(icon), color = VALUES(color),
            description = VALUES(description), sort_order = VALUES(sort_order),
            visibility = VALUES(visibility)`,
          [
            category.category_uid,
            category.slug,
            category.name,
            category.icon,
            category.color,
            category.description,
            category.sort_order,
            category.visibility ? 1 : 0,
          ],
        );
      });
    }

    for (const showcase of document.showcases) {
      await connection.query(
        `INSERT INTO website_showcases
          (showcase_uid, category_uid, name, slug, title, subtitle, description,
           cta_label, cta_link, glb_model_uid, glb_settings, image_path, benefits,
           style_settings, sort_order, visibility, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          category_uid = VALUES(category_uid), name = VALUES(name), slug = VALUES(slug),
          title = VALUES(title), subtitle = VALUES(subtitle), description = VALUES(description),
          cta_label = VALUES(cta_label), cta_link = VALUES(cta_link),
          glb_model_uid = VALUES(glb_model_uid), glb_settings = VALUES(glb_settings),
          image_path = VALUES(image_path), benefits = VALUES(benefits),
          style_settings = VALUES(style_settings), sort_order = VALUES(sort_order),
          visibility = VALUES(visibility), deleted_at = VALUES(deleted_at)`,
        [
          showcase.showcase_uid,
          showcase.category_uid,
          showcase.name,
          showcase.slug,
          showcase.title,
          showcase.subtitle,
          showcase.description,
          showcase.cta_label,
          showcase.cta_link,
          showcase.glb_model_uid,
          JSON.stringify(showcase.glb_settings || {}),
          showcase.image_path,
          JSON.stringify(showcase.benefits || []),
          JSON.stringify(showcase.style_settings || {}),
          showcase.sort_order,
          showcase.visibility ? 1 : 0,
          showcase.deleted_at,
        ],
      ).catch(async () => {
        await connection.query(
          `INSERT INTO website_showcases
            (showcase_uid, category_uid, name, slug, title, subtitle, description,
             cta_label, cta_link, glb_model_uid, glb_settings, sort_order, visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
            category_uid = VALUES(category_uid), name = VALUES(name), slug = VALUES(slug),
            title = VALUES(title), subtitle = VALUES(subtitle), description = VALUES(description),
            cta_label = VALUES(cta_label), cta_link = VALUES(cta_link),
            glb_model_uid = VALUES(glb_model_uid), glb_settings = VALUES(glb_settings),
            sort_order = VALUES(sort_order), visibility = VALUES(visibility)`,
          [
            showcase.showcase_uid,
            showcase.category_uid,
            showcase.name,
            showcase.slug,
            showcase.title,
            showcase.subtitle,
            showcase.description,
            showcase.cta_label,
            showcase.cta_link,
            showcase.glb_model_uid,
            JSON.stringify(showcase.glb_settings || {}),
            showcase.sort_order,
            showcase.visibility ? 1 : 0,
          ],
        );
      });
    }

    // Soft-delete showcases/categories present in previous publish but marked deleted in document
    const deletedShowcases = document.showcases.filter((s) => s.deleted_at || s.visibility === false);
    for (const s of deletedShowcases) {
      if (s.deleted_at) {
        await connection
          .query(`UPDATE website_showcases SET deleted_at = ?, visibility = 0 WHERE showcase_uid = ?`, [
            s.deleted_at,
            s.showcase_uid,
          ])
          .catch(() => undefined);
      }
    }

    const versionUid = `wv_${crypto.randomBytes(12).toString("hex")}`;
    await connection.query(
      `INSERT INTO website_versions (version_uid, entity_type, entity_uid, snapshot)
       VALUES (?, 'landing', 'home', ?)`,
      [versionUid, JSON.stringify({ at: new Date().toISOString(), document: previous })],
    );

    const draft = await connection.query(
      "SELECT revision FROM website_landing_drafts WHERE id = 1 LIMIT 1",
    );
    const draftRows = (draft as any)[0] as Array<{ revision: number }>;
    const currentRevision = Number(draftRows?.[0]?.revision || input.expectedRevision);
    if (Number(input.expectedRevision) !== currentRevision && draftRows?.[0]) {
      throw new LandingEditorValidationError(
        `Draft revision conflict (expected ${input.expectedRevision}, found ${currentRevision})`,
      );
    }
    const nextRevision = currentRevision + 1;

    await connection.query(
      `INSERT INTO website_landing_drafts (id, document_json, revision, status, updated_by, published_at)
       VALUES (1, ?, ?, 'published', ?, NOW())
       ON DUPLICATE KEY UPDATE
         document_json = VALUES(document_json),
         revision = VALUES(revision),
         status = 'published',
         updated_by = VALUES(updated_by),
         published_at = NOW()`,
      [JSON.stringify(document), nextRevision, input.adminId ?? null],
    );

    await connection.commit();
    return { revision: nextRevision, versionUid, document };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listLandingVersions(limit = 20) {
  await ensureLandingEditorSchema();
  return query<{
    version_uid: string;
    created_at: Date | string;
  }>(
    `SELECT version_uid, created_at FROM website_versions
     WHERE entity_type = 'landing' AND entity_uid = 'home'
     ORDER BY created_at DESC LIMIT ?`,
    [Math.min(Math.max(limit, 1), 50)],
  );
}

export async function restoreLandingVersion(input: {
  versionUid: string;
  adminId?: number | null;
}): Promise<{ revision: number; document: LandingEditorDocument }> {
  await ensureLandingEditorSchema();
  const rows = await query<{ snapshot: string }>(
    `SELECT snapshot FROM website_versions
     WHERE version_uid = ? AND entity_type = 'landing' AND entity_uid = 'home'
     LIMIT 1`,
    [input.versionUid],
  );
  if (!rows[0]) throw new LandingEditorValidationError("Version not found");

  const parsed = parseJson<{ document?: LandingEditorDocument }>(rows[0].snapshot, {});
  if (!parsed.document) throw new LandingEditorValidationError("Version snapshot is invalid");

  const current = await readDraftRow();
  const expectedRevision = current ? Number(current.revision) : 1;
  const saved = await saveLandingDraft({
    document: parsed.document,
    expectedRevision,
    adminId: input.adminId,
  });

  const published = await publishLandingDocument({
    document: saved.document,
    expectedRevision: saved.revision,
    adminId: input.adminId,
  });

  return { revision: published.revision, document: published.document };
}

/** Pure helpers exported for unit tests. */
export function applyShowcaseReorder(
  showcases: LandingShowcaseDoc[],
  orderedUids: string[],
): LandingShowcaseDoc[] {
  const byUid = new Map(showcases.map((s) => [s.showcase_uid, s]));
  const next: LandingShowcaseDoc[] = [];
  orderedUids.forEach((uid, index) => {
    const row = byUid.get(uid);
    if (row) next.push({ ...row, sort_order: index });
  });
  for (const row of showcases) {
    if (!orderedUids.includes(row.showcase_uid)) {
      next.push({ ...row, sort_order: next.length });
    }
  }
  return next;
}

export function softDeleteShowcase(
  showcases: LandingShowcaseDoc[],
  showcaseUid: string,
  at = new Date().toISOString(),
): LandingShowcaseDoc[] {
  return showcases.map((s) =>
    s.showcase_uid === showcaseUid ? { ...s, deleted_at: at, visibility: false } : s,
  );
}

export { snapshotPublished };
