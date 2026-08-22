import { query } from "@/lib/db";
import type { WorkspaceRow } from "./workspace.service";

export type BrandingConfig = {
  logoUrl: string | null;
  brandName: string | null;
  brandColor: string;
  accentColor: string | null;
  viewerWatermark: boolean;
  removeBranding: boolean;
  customViewerTheme: string;
  /** Short line under brand name in the public viewer. */
  viewerTagline: string | null;
  /** Custom label for the primary AR CTA (default: View in AR). */
  ctaLabel: string | null;
  /** Optional brand website opened from the viewer header. */
  websiteUrl: string | null;
  /** Custom loading copy while the model prepares. */
  loadingMessage: string | null;
  /** Primary CTA look: filled | outline | soft */
  buttonStyle: string;
  /** Viewer chrome: glass | solid | minimal */
  headerStyle: string;
  /** Typography: system | sans | serif | display */
  viewerFont: string;
  /** Optional browser tab icon for the public viewer. */
  faviconUrl: string | null;
  /** When brand name is set, still show product title in the header line. */
  showProductTitle: boolean;
  /** Hide the drag / pinch tip chip above the model. */
  hideInteractionHint: boolean;
  /** Replaces "AR360" in "Powered by …". Empty = AR360. */
  poweredByLabel: string | null;
};

function mapBrandingRow(row: WorkspaceRow): BrandingConfig {
  return {
    logoUrl: row.logo_url,
    brandName: row.brand_name,
    brandColor: row.brand_color ?? "#B8FF3C",
    accentColor: row.accent_color,
    viewerWatermark: Boolean(row.viewer_watermark),
    removeBranding: Boolean(row.remove_branding),
    customViewerTheme: row.custom_viewer_theme ?? "default",
    viewerTagline: row.viewer_tagline ?? null,
    ctaLabel: row.cta_label ?? null,
    websiteUrl: row.website_url ?? null,
    loadingMessage: row.loading_message ?? null,
    buttonStyle: row.button_style ?? "filled",
    headerStyle: row.header_style ?? "glass",
    viewerFont: row.viewer_font ?? "system",
    faviconUrl: row.favicon_url ?? null,
    showProductTitle: row.show_product_title == null ? true : Boolean(row.show_product_title),
    hideInteractionHint: Boolean(row.hide_interaction_hint),
    poweredByLabel: row.powered_by_label ?? null,
  };
}

const BRANDING_SELECT = `logo_url, brand_name, brand_color, accent_color,
            viewer_watermark, remove_branding, custom_viewer_theme,
            viewer_tagline, cta_label, website_url, loading_message,
            button_style, header_style, viewer_font, favicon_url,
            show_product_title, hide_interaction_hint, powered_by_label`;

const DEFAULT_VIEWER_BRANDING: BrandingConfig = {
  logoUrl: null,
  brandName: null,
  brandColor: "#B8FF3C",
  accentColor: null,
  viewerWatermark: false,
  removeBranding: false,
  customViewerTheme: "default",
  viewerTagline: null,
  ctaLabel: null,
  websiteUrl: null,
  loadingMessage: null,
  buttonStyle: "filled",
  headerStyle: "glass",
  viewerFont: "system",
  faviconUrl: null,
  showProductTitle: true,
  hideInteractionHint: false,
  poweredByLabel: null,
};

export async function getBranding(workspaceUid: string): Promise<BrandingConfig | null> {
  const rows = await query<WorkspaceRow>(
    `SELECT ${BRANDING_SELECT}
     FROM workspaces WHERE workspace_uid = ? AND status != 'deleted' LIMIT 1`,
    [workspaceUid],
  );
  const row = rows[0];
  if (!row) return null;
  return mapBrandingRow(row);
}

export async function updateBranding(
  workspaceUid: string,
  config: Partial<BrandingConfig>,
): Promise<void> {
  const fields: Array<{
    input: keyof BrandingConfig;
    column: string;
  }> = [
    { input: "logoUrl", column: "logo_url" },
    { input: "brandName", column: "brand_name" },
    { input: "brandColor", column: "brand_color" },
    { input: "accentColor", column: "accent_color" },
    { input: "viewerWatermark", column: "viewer_watermark" },
    { input: "removeBranding", column: "remove_branding" },
    { input: "customViewerTheme", column: "custom_viewer_theme" },
    { input: "viewerTagline", column: "viewer_tagline" },
    { input: "ctaLabel", column: "cta_label" },
    { input: "websiteUrl", column: "website_url" },
    { input: "loadingMessage", column: "loading_message" },
    { input: "buttonStyle", column: "button_style" },
    { input: "headerStyle", column: "header_style" },
    { input: "viewerFont", column: "viewer_font" },
    { input: "faviconUrl", column: "favicon_url" },
    { input: "showProductTitle", column: "show_product_title" },
    { input: "hideInteractionHint", column: "hide_interaction_hint" },
    { input: "poweredByLabel", column: "powered_by_label" },
  ];

  const sets: string[] = [];
  const vals: (string | boolean | number | null)[] = [];

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(config, field.input)) continue;
    const value = config[field.input];
    if (value === undefined) continue;
    sets.push(`${field.column} = ?`);
    vals.push(value);
  }
  if (!sets.length) return;
  vals.push(workspaceUid);
  await query(`UPDATE workspaces SET ${sets.join(", ")} WHERE workspace_uid = ?`, vals);
}

/**
 * Resolve branding for public viewer / share / embed by product customer_uid.
 *
 * Preference order (documented product rule):
 * 1. Workspace that owns the customer's primary verified custom domain
 * 2. Earliest non-deleted workspace for that customer (owner / default workspace)
 * 3. Hard-coded AR360 defaults
 */
export async function getViewerBranding(customerUid: string): Promise<BrandingConfig> {
  const preferred = await query<{ workspace_uid: string }>(
    `SELECT workspace_uid FROM custom_domains
      WHERE customer_uid = ? AND status = 'verified'
      ORDER BY is_primary DESC, verified_at DESC, id ASC
      LIMIT 1`,
    [customerUid],
  ).catch(() => [] as { workspace_uid: string }[]);

  if (preferred[0]?.workspace_uid) {
    const byDomain = await query<WorkspaceRow>(
      `SELECT ${BRANDING_SELECT}
         FROM workspaces
        WHERE workspace_uid = ? AND status != 'deleted'
        LIMIT 1`,
      [preferred[0].workspace_uid],
    );
    if (byDomain[0]) return mapBrandingRow(byDomain[0]);
  }

  const rows = await query<WorkspaceRow>(
    `SELECT ${BRANDING_SELECT}
       FROM workspaces
      WHERE customer_uid = ? AND status != 'deleted'
      ORDER BY created_at ASC
      LIMIT 1`,
    [customerUid],
  );
  const row = rows[0];
  if (!row) return DEFAULT_VIEWER_BRANDING;
  return mapBrandingRow(row);
}
