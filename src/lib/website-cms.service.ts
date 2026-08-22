import { query } from "@/lib/db";

export type NavItem = {
  label: string;
  link_url: string;
  sort_order: number;
};

export type LandingSectionData = {
  section_key: string;
  title: string;
  subtitle: string;
  description: string;
  buttons: any[];
  images: any[];
  background: string;
  visibility: boolean;
  glb_path: string | null;
  glb_settings: any;
};

export async function getDynamicNavigation(type: "navbar" | "footer"): Promise<(NavItem & { nav_uid?: string })[]> {
  try {
    const rows = await query<any>(
      "SELECT nav_uid, label, link_url, sort_order FROM website_navigation WHERE menu_type = ? AND visibility = 1 ORDER BY sort_order ASC",
      [type]
    );
    return rows;
  } catch {
    return [];
  }
}

export async function getWebsiteSettings(): Promise<Record<string, string>> {
  try {
    const rows = await query<{ setting_key: string; setting_value: string | null }>(
      "SELECT setting_key, setting_value FROM website_settings"
    );
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.setting_key] = r.setting_value || "";
    }
    return settings;
  } catch {
    return {};
  }
}

export async function getLandingSections(): Promise<LandingSectionData[]> {
  try {
    const rows = await query<any>(`
      SELECT 
        s.section_key, 
        s.title, 
        s.subtitle, 
        s.description, 
        s.buttons, 
        s.images, 
        s.background, 
        s.visibility,
        m.file_path AS glb_path,
        s.glb_settings,
        s.style_settings
      FROM website_sections s
      LEFT JOIN website_models m ON s.glb_model_uid = m.model_uid
      WHERE s.visibility = 1
      ORDER BY s.sort_order ASC
    `).catch(async () =>
      query<any>(`
        SELECT 
          s.section_key, 
          s.title, 
          s.subtitle, 
          s.description, 
          s.buttons, 
          s.images, 
          s.background, 
          s.visibility,
          m.file_path AS glb_path,
          s.glb_settings
        FROM website_sections s
        LEFT JOIN website_models m ON s.glb_model_uid = m.model_uid
        WHERE s.visibility = 1
        ORDER BY s.sort_order ASC
      `),
    );

    return rows.map((r: any) => ({
      section_key: r.section_key,
      title: r.title,
      subtitle: r.subtitle,
      description: r.description || "",
      buttons: typeof r.buttons === "string" ? JSON.parse(r.buttons) : (r.buttons || []),
      images: typeof r.images === "string" ? JSON.parse(r.images) : (r.images || []),
      background: r.background,
      visibility: Boolean(r.visibility),
      glb_path: r.glb_path,
      glb_settings: typeof r.glb_settings === "string" ? JSON.parse(r.glb_settings) : (r.glb_settings || {}),
      style_settings:
        typeof r.style_settings === "string"
          ? JSON.parse(r.style_settings)
          : r.style_settings || {},
    }));
  } catch {
    return [];
  }
}

export async function getDefaultGlbModel(): Promise<string> {
  try {
    const rows = await query<{ file_path: string }>(
      "SELECT file_path FROM website_models WHERE is_default = 1 AND status = 'active' LIMIT 1"
    );
    return rows[0]?.file_path || "/models/chair_01.glb";
  } catch {
    return "/models/chair_01.glb";
  }
}

export async function getPageBySlug(slug: string): Promise<{ title: string; content: string } | null> {
  try {
    const rows = await query<{ title: string; content: string }>(
      "SELECT title, content FROM website_pages WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function getShowcaseCategories(): Promise<any[]> {
  try {
    // Read-only on the public homepage — seeding runs from Master Admin / CMS APIs.
    return await query<any>(
      `SELECT * FROM website_categories
       WHERE visibility = 1 AND (deleted_at IS NULL)
       ORDER BY sort_order ASC`,
    ).catch(async () =>
      query<any>("SELECT * FROM website_categories WHERE visibility = 1 ORDER BY sort_order ASC"),
    );
  } catch {
    return [];
  }
}

export async function getShowcaseItems(): Promise<any[]> {
  try {
    const rows = await query<any>(`
      SELECT s.*, m.file_path 
      FROM website_showcases s 
      LEFT JOIN website_models m ON s.glb_model_uid = m.model_uid 
      WHERE s.visibility = 1 AND (s.deleted_at IS NULL)
      ORDER BY s.sort_order ASC
    `).catch(async () =>
      query<any>(`
        SELECT s.*, m.file_path
        FROM website_showcases s
        LEFT JOIN website_models m ON s.glb_model_uid = m.model_uid
        WHERE s.visibility = 1
        ORDER BY s.sort_order ASC
      `),
    );

    return rows.map((r: any) => ({
      ...r,
      benefits: typeof r.benefits === "string" ? JSON.parse(r.benefits) : r.benefits || [],
      style_settings:
        typeof r.style_settings === "string" ? JSON.parse(r.style_settings) : r.style_settings || {},
    }));
  } catch {
    return [];
  }
}

export async function getWebsiteCardsBySection(sectionUid: string): Promise<any[]> {
  try {
    return await query<any>(
      "SELECT * FROM website_cards WHERE section_uid = ? AND visibility = 1 ORDER BY sort_order ASC",
      [sectionUid]
    );
  } catch {
    return [];
  }
}

/** Batch card fetch for landing — one query instead of N. */
export async function getWebsiteCardsBySections(
  sectionUids: string[],
): Promise<Record<string, any[]>> {
  const result: Record<string, any[]> = {};
  for (const uid of sectionUids) result[uid] = [];
  if (!sectionUids.length) return result;
  try {
    const placeholders = sectionUids.map(() => "?").join(",");
    const rows = await query<any>(
      `SELECT * FROM website_cards
       WHERE section_uid IN (${placeholders}) AND visibility = 1
       ORDER BY sort_order ASC`,
      sectionUids,
    );
    for (const row of rows) {
      const key = String(row.section_uid);
      if (!result[key]) result[key] = [];
      result[key].push(row);
    }
    return result;
  } catch {
    return result;
  }
}

