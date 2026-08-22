import { getCurrentMasterAdmin } from "@/lib/auth";
import {
  getDefaultGlbModel,
  getDynamicNavigation,
  getLandingSections,
  getShowcaseCategories,
  getShowcaseItems,
  getWebsiteCardsBySections,
  getWebsiteSettings,
} from "@/lib/website-cms.service";
import { getDraftOrPublishedDocument } from "@/lib/website/landing-editor.service";
import type { LandingEditorDocument } from "@/lib/website/landing-editor.types";
import { query } from "@/lib/db";

export type LandingRenderBundle = {
  previewMode: boolean;
  navItems: { label: string; link_url: string; sort_order: number; nav_uid?: string }[];
  footerItems: { label: string; link_url: string; sort_order: number; nav_uid?: string }[];
  settings: Record<string, string>;
  sections: any[];
  defaultGlb: string;
  categories: any[];
  showcases: any[];
  cardsBySection: Record<string, any[]>;
};

function fromDocument(document: LandingEditorDocument, defaultGlb: string): LandingRenderBundle {
  const navItems = document.navigation
    .filter((n) => n.menu_type === "navbar" && n.visibility)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((n) => ({
      label: n.label,
      link_url: n.link_url,
      sort_order: n.sort_order,
      nav_uid: n.nav_uid,
    }));

  const footerItems = document.navigation
    .filter((n) => n.menu_type === "footer" && n.visibility)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((n) => ({
      label: n.label,
      link_url: n.link_url,
      sort_order: n.sort_order,
      nav_uid: n.nav_uid,
    }));

  const sections = document.sections
    .filter((s) => s.visibility)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      section_key: s.section_key,
      title: s.title,
      subtitle: s.subtitle,
      description: s.description,
      buttons: s.buttons,
      images: s.images,
      background: s.background,
      visibility: s.visibility,
      glb_path: null as string | null,
      glb_model_uid: s.glb_model_uid,
      glb_settings: s.glb_settings,
      style_settings: s.style_settings,
    }));

  const cardsBySection: Record<string, any[]> = {
    ws_faq: [],
    ws_trusted: [],
    ws_analytics: [],
    ws_features: [],
    ws_share_portal: [],
  };
  for (const card of document.cards.filter((c) => c.visibility).sort((a, b) => a.sort_order - b.sort_order)) {
    if (!cardsBySection[card.section_uid]) cardsBySection[card.section_uid] = [];
    cardsBySection[card.section_uid].push(card);
  }

  const categories = document.categories
    .filter((c) => c.visibility && !c.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order);

  const showcases = document.showcases
    .filter((s) => s.visibility && !s.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    previewMode: true,
    navItems,
    footerItems,
    settings: document.settings,
    sections,
    defaultGlb,
    categories,
    showcases,
    cardsBySection,
  };
}

async function hydrateGlbPaths(sections: any[]) {
  const uids = sections.map((s) => s.glb_model_uid).filter(Boolean);
  if (!uids.length) return sections;
  const placeholders = uids.map(() => "?").join(",");
  const rows = await query<{ model_uid: string; file_path: string }>(
    `SELECT model_uid, file_path FROM website_models WHERE model_uid IN (${placeholders})`,
    uids as string[],
  ).catch(() => [] as Array<{ model_uid: string; file_path: string }>);
  const map = new Map(rows.map((r) => [r.model_uid, r.file_path]));
  return sections.map((s) => ({
    ...s,
    glb_path: (s.glb_model_uid && map.get(s.glb_model_uid)) || s.glb_path || null,
  }));
}

export async function loadLandingRenderBundle(options?: {
  cmsPreview?: boolean;
}): Promise<LandingRenderBundle> {
  const wantPreview = Boolean(options?.cmsPreview);
  let previewMode = false;

  if (wantPreview) {
    const admin = await getCurrentMasterAdmin().catch(() => null);
    previewMode = Boolean(admin);
  }

  if (previewMode) {
    const [document, defaultGlb] = await Promise.all([
      getDraftOrPublishedDocument(true),
      getDefaultGlbModel(),
    ]);
    const bundle = fromDocument(document, defaultGlb);
    bundle.sections = await hydrateGlbPaths(bundle.sections);
    return bundle;
  }

  const [navItems, footerItems, settings, sections, defaultGlb, categories, showcases, cardsBySection] =
    await Promise.all([
      getDynamicNavigation("navbar"),
      getDynamicNavigation("footer"),
      getWebsiteSettings(),
      getLandingSections(),
      getDefaultGlbModel(),
      getShowcaseCategories(),
      getShowcaseItems(),
      getWebsiteCardsBySections([
        "ws_faq",
        "ws_trusted",
        "ws_analytics",
        "ws_features",
        "ws_share_portal",
      ]),
    ]);

  return {
    previewMode: false,
    navItems,
    footerItems,
    settings,
    sections,
    defaultGlb,
    categories,
    showcases,
    cardsBySection,
  };
}
