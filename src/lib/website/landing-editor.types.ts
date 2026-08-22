/** Shared types for the Visual Landing Page Editor document model. */

export const LANDING_SPACING = ["compact", "normal", "spacious"] as const;
export const LANDING_ALIGN = ["left", "center", "right"] as const;
export const LANDING_FONT_SIZE = ["sm", "md", "lg", "xl"] as const;

export type LandingSpacing = (typeof LANDING_SPACING)[number];
export type LandingAlign = (typeof LANDING_ALIGN)[number];
export type LandingFontSize = (typeof LANDING_FONT_SIZE)[number];

export type LandingStyleSettings = {
  spacing?: LandingSpacing;
  align?: LandingAlign;
  fontSize?: LandingFontSize;
  textColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  focalX?: number;
  focalY?: number;
};

export type LandingButton = {
  label: string;
  href: string;
  style?: string;
};

export type LandingNavItem = {
  nav_uid: string;
  menu_type: "navbar" | "footer";
  label: string;
  link_url: string;
  parent_uid: string | null;
  sort_order: number;
  icon: string | null;
  visibility: boolean;
};

export type LandingSectionDoc = {
  section_uid: string;
  page_uid: string;
  section_key: string;
  title: string;
  subtitle: string;
  description: string;
  buttons: LandingButton[];
  images: unknown[];
  background: string;
  visibility: boolean;
  sort_order: number;
  glb_model_uid: string | null;
  glb_settings: Record<string, unknown>;
  style_settings: LandingStyleSettings;
};

export type LandingCardDoc = {
  card_uid: string;
  section_uid: string;
  title: string;
  description: string;
  image_path: string | null;
  glb_path: string | null;
  button_label: string | null;
  button_link: string | null;
  features: unknown[];
  sort_order: number;
  visibility: boolean;
  style_settings: LandingStyleSettings;
};

export type LandingCategoryDoc = {
  category_uid: string;
  slug: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string;
  sort_order: number;
  visibility: boolean;
  deleted_at: string | null;
};

export type LandingShowcaseDoc = {
  showcase_uid: string;
  category_uid: string;
  name: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  cta_label: string;
  cta_link: string;
  glb_model_uid: string | null;
  glb_settings: Record<string, unknown>;
  image_path: string | null;
  benefits: string[];
  style_settings: LandingStyleSettings;
  sort_order: number;
  visibility: boolean;
  deleted_at: string | null;
};

export type LandingEditorDocument = {
  version: 1;
  settings: Record<string, string>;
  navigation: LandingNavItem[];
  sections: LandingSectionDoc[];
  cards: LandingCardDoc[];
  categories: LandingCategoryDoc[];
  showcases: LandingShowcaseDoc[];
};

export type LandingDraftMeta = {
  revision: number;
  status: "draft" | "published";
  updated_at: string | null;
  published_at: string | null;
  dirty: boolean;
};

export type LandingEditorTargetKind =
  | "section"
  | "card"
  | "nav"
  | "setting"
  | "showcase"
  | "category"
  | "popup"
  | "footer"
  | "social";

export type CmsSelectMessage = {
  type: "ar360-cms-select";
  target: string;
  rect?: { top: number; left: number; width: number; height: number };
};

export type CmsReadyMessage = {
  type: "ar360-cms-ready";
};

export const FREE_TRIAL_SETTING_KEYS = [
  "free_trial_popup_badge",
  "free_trial_popup_title",
  "free_trial_popup_description",
  "free_trial_popup_primary_label",
  "free_trial_popup_secondary_label",
  "free_trial_popup_scan_title",
  "free_trial_popup_scan_note",
  "free_trial_popup_phone_image",
  "free_trial_popup_phone_image_mobile",
  "free_trial_popup_visible",
  "free_trial_popup_primary_href",
  "free_trial_popup_secondary_href",
] as const;

export const COMPANY_SETTING_KEYS = [
  "company_name",
  "support_email",
  "contact_phone",
  "contact_email",
  "gst_number",
  "address",
  "copyright",
  "social_linkedin",
  "social_instagram",
  "social_x",
  "social_twitter",
] as const;
