import {
  COMPANY_SETTING_KEYS,
  FREE_TRIAL_SETTING_KEYS,
  LANDING_ALIGN,
  LANDING_FONT_SIZE,
  LANDING_SPACING,
  type LandingAlign,
  type LandingEditorDocument,
  type LandingFontSize,
  type LandingSpacing,
  type LandingStyleSettings,
} from "@/lib/website/landing-editor.types";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const MAX_DOCUMENT_CHARS = 1_500_000;
const MAX_TEXT = 8_000;
const MAX_URL = 500;
const MAX_BENEFITS = 12;

const ALLOWED_SETTING_KEYS = new Set<string>([
  ...FREE_TRIAL_SETTING_KEYS,
  ...COMPANY_SETTING_KEYS,
]);

export class LandingEditorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandingEditorValidationError";
  }
}

export function isSafeLandingUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return false;
    if (trimmed.includes("javascript:", 0) || /[\u0000-\u001f]/.test(trimmed)) return false;
    return trimmed.length <= MAX_URL;
  }
  try {
    const url = new URL(trimmed);
    return (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") &&
      trimmed.length <= MAX_URL;
  } catch {
    return false;
  }
}

export function isSafeMediaPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/home/") || trimmed.startsWith("/models/")) {
    if (trimmed.includes("..") || trimmed.includes("//", 1)) return false;
    return trimmed.length <= MAX_URL && !/[\u0000-\u001f]/.test(trimmed);
  }
  return isSafeLandingUrl(trimmed) && /^https?:\/\//i.test(trimmed);
}

export function sanitizeStyleSettings(input: unknown): LandingStyleSettings {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: LandingStyleSettings = {};

  if (typeof raw.spacing === "string" && (LANDING_SPACING as readonly string[]).includes(raw.spacing)) {
    out.spacing = raw.spacing as LandingSpacing;
  }
  if (typeof raw.align === "string" && (LANDING_ALIGN as readonly string[]).includes(raw.align)) {
    out.align = raw.align as LandingAlign;
  }
  if (typeof raw.fontSize === "string" && (LANDING_FONT_SIZE as readonly string[]).includes(raw.fontSize)) {
    out.fontSize = raw.fontSize as LandingFontSize;
  }
  for (const key of ["textColor", "backgroundColor", "accentColor"] as const) {
    const val = raw[key];
    if (typeof val === "string" && HEX_COLOR.test(val.trim())) {
      out[key] = val.trim();
    }
  }
  for (const key of ["focalX", "focalY"] as const) {
    const val = raw[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      out[key] = Math.min(100, Math.max(0, val));
    }
  }
  return out;
}

function assertText(value: unknown, label: string, max = MAX_TEXT): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new LandingEditorValidationError(`${label} must be a string`);
  if (value.length > max) throw new LandingEditorValidationError(`${label} is too long`);
  return value;
}

function assertUrl(value: unknown, label: string): string {
  const text = assertText(value, label, MAX_URL);
  if (text && !isSafeLandingUrl(text)) {
    throw new LandingEditorValidationError(`${label} contains an unsafe URL`);
  }
  return text;
}

/**
 * Card `button_link` is overloaded in this CMS:
 * - share-portal steps store a short step label ("Generate QR")
 * - other cards may store a real href
 * Accept either a safe URL/path OR a plain label (no protocol / javascript).
 */
export function isSafeCardLinkOrLabel(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/javascript:/i.test(trimmed) || /[\u0000-\u001f]/.test(trimmed)) return false;
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("mailto:")
  ) {
    return isSafeLandingUrl(trimmed);
  }
  // Plain UI label — keep short and free of URL schemes.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  return trimmed.length <= 120;
}

function assertCardLinkOrLabel(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  const text = assertText(value, label, MAX_URL);
  if (!isSafeCardLinkOrLabel(text)) {
    throw new LandingEditorValidationError(`${label} contains an unsafe URL`);
  }
  return text;
}

function assertMedia(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  const text = assertText(value, label, MAX_URL);
  if (!isSafeMediaPath(text)) {
    throw new LandingEditorValidationError(`${label} contains an unsafe media path`);
  }
  return text;
}

function parseJsonMaybe(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function validateLandingDocument(input: unknown): LandingEditorDocument {
  if (!input || typeof input !== "object") {
    throw new LandingEditorValidationError("Document must be an object");
  }
  const serialized = JSON.stringify(input);
  if (serialized.length > MAX_DOCUMENT_CHARS) {
    throw new LandingEditorValidationError("Document payload is too large");
  }

  const raw = input as Record<string, unknown>;
  if (raw.version !== 1) {
    throw new LandingEditorValidationError("Unsupported document version");
  }

  const settings: Record<string, string> = {};
  if (raw.settings && typeof raw.settings === "object") {
    for (const [key, val] of Object.entries(raw.settings as Record<string, unknown>)) {
      if (!ALLOWED_SETTING_KEYS.has(key) && !key.startsWith("free_trial_popup_") && !key.startsWith("social_")) {
        // Reject unknown keys that look like injection; allow a small extra allowlist of known CMS keys.
        if (!/^[a-z][a-z0-9_]{1,80}$/.test(key)) {
          throw new LandingEditorValidationError(`Unsupported setting key: ${key}`);
        }
      }
      const text = assertText(val, `settings.${key}`, 4000);
      if ((key.includes("link") || key.includes("href") || key.startsWith("social_")) && text && !isSafeLandingUrl(text)) {
        throw new LandingEditorValidationError(`settings.${key} has an unsafe URL`);
      }
      if (key.includes("image") && text && !isSafeMediaPath(text)) {
        throw new LandingEditorValidationError(`settings.${key} has an unsafe image path`);
      }
      settings[key] = text;
    }
  }

  const navigation = Array.isArray(raw.navigation) ? raw.navigation : [];
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  const cards = Array.isArray(raw.cards) ? raw.cards : [];
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  const showcases = Array.isArray(raw.showcases) ? raw.showcases : [];

  return {
    version: 1,
    settings,
    navigation: navigation.map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        nav_uid: assertText(row.nav_uid || `wn_${index}`, "nav_uid", 40),
        menu_type: row.menu_type === "footer" ? "footer" : "navbar",
        label: assertText(row.label, "nav.label", 100) || "Link",
        link_url: assertUrl(row.link_url, "nav.link_url") || "#",
        parent_uid: row.parent_uid ? assertText(row.parent_uid, "nav.parent_uid", 40) : null,
        sort_order: Number(row.sort_order || 0) || 0,
        icon: row.icon ? assertText(row.icon, "nav.icon", 50) : null,
        visibility: row.visibility !== false,
      };
    }),
    sections: sections.map((item, index) => {
      const row = item as Record<string, unknown>;
      const buttonsRaw = parseJsonMaybe(row.buttons);
      const imagesRaw = parseJsonMaybe(row.images);
      const glbSettings = parseJsonMaybe(row.glb_settings);
      return {
        section_uid: assertText(row.section_uid || `ws_${index}`, "section_uid", 40),
        page_uid: assertText(row.page_uid || "wp_home", "page_uid", 40),
        section_key: assertText(row.section_key, "section_key", 80),
        title: assertText(row.title, "section.title", 255),
        subtitle: assertText(row.subtitle, "section.subtitle", 255),
        description: assertText(row.description, "section.description"),
        buttons: Array.isArray(buttonsRaw)
          ? buttonsRaw.map((b) => {
              const btn = b as Record<string, unknown>;
              return {
                label: assertText(btn.label, "button.label", 120),
                href: assertUrl(btn.href, "button.href") || "#",
                style: btn.style ? assertText(btn.style, "button.style", 40) : undefined,
              };
            })
          : [],
        images: Array.isArray(imagesRaw) ? imagesRaw : [],
        background: assertText(row.background || "bg-white", "section.background", 100),
        visibility: row.visibility !== false,
        sort_order: Number(row.sort_order || 0) || 0,
        glb_model_uid: row.glb_model_uid ? assertText(row.glb_model_uid, "glb_model_uid", 40) : null,
        glb_settings:
          glbSettings && typeof glbSettings === "object" && !Array.isArray(glbSettings)
            ? (glbSettings as Record<string, unknown>)
            : {},
        style_settings: sanitizeStyleSettings(parseJsonMaybe(row.style_settings)),
      };
    }),
    cards: cards.map((item, index) => {
      const row = item as Record<string, unknown>;
      const features = parseJsonMaybe(row.features);
      return {
        card_uid: assertText(row.card_uid || `wc_${index}`, "card_uid", 40),
        section_uid: assertText(row.section_uid, "card.section_uid", 40),
        title: assertText(row.title, "card.title", 255),
        description: assertText(row.description, "card.description"),
        image_path: assertMedia(row.image_path, "card.image_path"),
        glb_path: assertMedia(row.glb_path, "card.glb_path"),
        button_label: row.button_label ? assertText(row.button_label, "card.button_label", 100) : null,
        button_link: assertCardLinkOrLabel(row.button_link, "card.button_link"),
        features: Array.isArray(features) ? features : [],
        sort_order: Number(row.sort_order || 0) || 0,
        visibility: row.visibility !== false,
        style_settings: sanitizeStyleSettings(parseJsonMaybe(row.style_settings)),
      };
    }),
    categories: categories.map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        category_uid: assertText(row.category_uid || `cat_${index}`, "category_uid", 40),
        slug: assertText(row.slug, "category.slug", 100),
        name: assertText(row.name, "category.name", 100),
        icon: row.icon ? assertText(row.icon, "category.icon", 50) : null,
        color: row.color ? assertText(row.color, "category.color", 30) : null,
        description: assertText(row.description, "category.description"),
        sort_order: Number(row.sort_order || 0) || 0,
        visibility: row.visibility !== false,
        deleted_at: row.deleted_at ? assertText(row.deleted_at, "category.deleted_at", 40) : null,
      };
    }),
    showcases: showcases.map((item, index) => {
      const row = item as Record<string, unknown>;
      const benefitsRaw = parseJsonMaybe(row.benefits);
      const benefits = Array.isArray(benefitsRaw)
        ? benefitsRaw.map((b, i) => assertText(b, `showcase.benefits[${i}]`, 200)).slice(0, MAX_BENEFITS)
        : [];
      const glbSettings = parseJsonMaybe(row.glb_settings);
      return {
        showcase_uid: assertText(row.showcase_uid || `sh_${index}`, "showcase_uid", 40),
        category_uid: assertText(row.category_uid, "showcase.category_uid", 40),
        name: assertText(row.name, "showcase.name", 100),
        slug: assertText(row.slug, "showcase.slug", 100),
        title: assertText(row.title, "showcase.title", 255),
        subtitle: assertText(row.subtitle, "showcase.subtitle", 255),
        description: assertText(row.description, "showcase.description"),
        cta_label: assertText(row.cta_label, "showcase.cta_label", 100),
        cta_link: assertUrl(row.cta_link, "showcase.cta_link") || "/signup",
        glb_model_uid: row.glb_model_uid ? assertText(row.glb_model_uid, "showcase.glb_model_uid", 40) : null,
        glb_settings:
          glbSettings && typeof glbSettings === "object" && !Array.isArray(glbSettings)
            ? (glbSettings as Record<string, unknown>)
            : {},
        image_path: assertMedia(row.image_path, "showcase.image_path"),
        benefits,
        style_settings: sanitizeStyleSettings(parseJsonMaybe(row.style_settings)),
        sort_order: Number(row.sort_order || 0) || 0,
        visibility: row.visibility !== false,
        deleted_at: row.deleted_at ? assertText(row.deleted_at, "showcase.deleted_at", 40) : null,
      };
    }),
  };
}

export function styleSettingsToInline(
  style?: LandingStyleSettings | null,
): Record<string, string | number> {
  if (!style) return {};
  const css: Record<string, string | number> = {};
  if (style.textColor) css.color = style.textColor;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.align) css.textAlign = style.align;
  if (style.focalX != null || style.focalY != null) {
    css.objectPosition = `${style.focalX ?? 50}% ${style.focalY ?? 50}%`;
  }
  return css;
}

export function spacingClass(spacing?: LandingSpacing): string {
  switch (spacing) {
    case "compact":
      return "py-3 sm:py-6";
    case "spacious":
      return "py-10 sm:py-16 lg:py-20";
    default:
      return "";
  }
}

export function fontSizeClass(size?: LandingFontSize): string {
  switch (size) {
    case "sm":
      return "text-[0.92em]";
    case "lg":
      return "text-[1.08em]";
    case "xl":
      return "text-[1.16em]";
    default:
      return "";
  }
}
