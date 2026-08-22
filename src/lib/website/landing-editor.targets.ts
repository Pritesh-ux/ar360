import type { LandingEditorDocument } from "@/lib/website/landing-editor.types";

export type InspectorField =
  | { kind: "text"; key: string; label: string; multiline?: boolean; maxLength?: number }
  | { kind: "url"; key: string; label: string }
  | { kind: "media"; key: string; label: string; altKey?: string }
  | { kind: "toggle"; key: string; label: string }
  | { kind: "style"; label?: string }
  | { kind: "benefits"; key: string; label: string }
  | { kind: "buttons"; key: string; label: string }
  | { kind: "order"; label?: string }
  | { kind: "info"; text: string };

export type ResolvedTarget = {
  target: string;
  sectionId: string;
  title: string;
  fields: InspectorField[];
  path: string;
};

function sectionFields(hasButtons = false): InspectorField[] {
  const fields: InspectorField[] = [
    { kind: "text", key: "title", label: "Title", maxLength: 255 },
    { kind: "text", key: "subtitle", label: "Subtitle / eyebrow", maxLength: 255 },
    { kind: "text", key: "description", label: "Description", multiline: true },
    { kind: "toggle", key: "visibility", label: "Visible on site" },
    { kind: "style" },
  ];
  if (hasButtons) fields.splice(3, 0, { kind: "buttons", key: "buttons", label: "Buttons" });
  return fields;
}

export function resolveCmsTarget(
  target: string | null | undefined,
  document: LandingEditorDocument,
): ResolvedTarget | null {
  if (!target) return null;
  const parts = target.split(":");
  const kind = parts[0];

  if (kind === "section" && parts[1]) {
    const section = document.sections.find((s) => s.section_key === parts[1] || s.section_uid === parts[1]);
    if (!section) return null;
    const hasButtons = Array.isArray(section.buttons) && (section.buttons.length > 0 || section.section_key === "hero" || section.section_key === "cta");
    return {
      target,
      sectionId: section.section_key,
      title: `${section.section_key} section`,
      path: `sections[${section.section_uid}]`,
      fields: sectionFields(hasButtons),
    };
  }

  if (kind === "card" && parts[1]) {
    const card = document.cards.find((c) => c.card_uid === parts[1]);
    if (!card) return null;
    return {
      target,
      sectionId: card.section_uid,
      title: card.title || "Card",
      path: `cards[${card.card_uid}]`,
      fields: [
        { kind: "text", key: "title", label: "Title", maxLength: 255 },
        { kind: "text", key: "description", label: "Description", multiline: true },
        { kind: "text", key: "button_label", label: "Button / icon label", maxLength: 100 },
        { kind: "text", key: "button_link", label: "Link or step label", maxLength: 120 },
        { kind: "media", key: "image_path", label: "Image" },
        { kind: "toggle", key: "visibility", label: "Visible" },
        { kind: "order" },
        { kind: "style" },
      ],
    };
  }

  if (kind === "nav" && parts[1]) {
    const nav = document.navigation.find((n) => n.nav_uid === parts[1]);
    if (!nav) return null;
    return {
      target,
      sectionId: "header",
      title: `Nav · ${nav.label}`,
      path: `navigation[${nav.nav_uid}]`,
      fields: [
        { kind: "text", key: "label", label: "Label", maxLength: 100 },
        { kind: "url", key: "link_url", label: "Link" },
        { kind: "toggle", key: "visibility", label: "Visible" },
        { kind: "order" },
      ],
    };
  }

  if (kind === "showcase" && parts[1]) {
    const showcase = document.showcases.find((s) => s.showcase_uid === parts[1] || s.slug === parts[1]);
    if (!showcase) return null;
    return {
      target,
      sectionId: "usecases",
      title: `Use case · ${showcase.name}`,
      path: `showcases[${showcase.showcase_uid}]`,
      fields: [
        { kind: "text", key: "name", label: "Tab name", maxLength: 100 },
        { kind: "text", key: "title", label: "Title", maxLength: 255 },
        { kind: "text", key: "description", label: "Description", multiline: true },
        { kind: "benefits", key: "benefits", label: "Benefits" },
        { kind: "text", key: "cta_label", label: "CTA label", maxLength: 100 },
        { kind: "url", key: "cta_link", label: "CTA link" },
        { kind: "media", key: "image_path", label: "Cover image" },
        { kind: "toggle", key: "visibility", label: "Visible" },
        { kind: "order" },
        { kind: "style" },
      ],
    };
  }

  if (kind === "category" && parts[1]) {
    const category = document.categories.find((c) => c.category_uid === parts[1] || c.slug === parts[1]);
    if (!category) return null;
    return {
      target,
      sectionId: "usecases",
      title: `Category · ${category.name}`,
      path: `categories[${category.category_uid}]`,
      fields: [
        { kind: "text", key: "name", label: "Name", maxLength: 100 },
        { kind: "text", key: "description", label: "Description", multiline: true },
        { kind: "text", key: "icon", label: "Icon key", maxLength: 50 },
        { kind: "toggle", key: "visibility", label: "Visible" },
        { kind: "order" },
      ],
    };
  }

  if (kind === "popup") {
    return {
      target: "popup",
      sectionId: "popup",
      title: "Free trial popup",
      path: "settings",
      fields: [
        { kind: "toggle", key: "free_trial_popup_visible", label: "Show popup" },
        { kind: "text", key: "free_trial_popup_badge", label: "Badge" },
        { kind: "text", key: "free_trial_popup_title", label: "Title (*highlight*)", multiline: true },
        { kind: "text", key: "free_trial_popup_description", label: "Description", multiline: true },
        { kind: "text", key: "free_trial_popup_primary_label", label: "Primary CTA" },
        { kind: "url", key: "free_trial_popup_primary_href", label: "Primary link" },
        { kind: "text", key: "free_trial_popup_secondary_label", label: "Secondary CTA" },
        { kind: "url", key: "free_trial_popup_secondary_href", label: "Secondary link" },
        { kind: "text", key: "free_trial_popup_scan_title", label: "Scan title" },
        { kind: "text", key: "free_trial_popup_scan_note", label: "Scan note" },
        { kind: "media", key: "free_trial_popup_phone_image", label: "Phone image (desktop)" },
        { kind: "media", key: "free_trial_popup_phone_image_mobile", label: "Phone image (mobile)" },
      ],
    };
  }

  if (kind === "footer") {
    return {
      target: "footer",
      sectionId: "footer",
      title: "Footer / contact",
      path: "settings",
      fields: [
        { kind: "text", key: "company_name", label: "Company name" },
        { kind: "text", key: "address", label: "Address", multiline: true },
        { kind: "text", key: "contact_email", label: "Contact email" },
        { kind: "text", key: "contact_phone", label: "Contact phone" },
        { kind: "text", key: "copyright", label: "Copyright" },
        { kind: "info", text: "Footer links are under Navigation (footer)." },
      ],
    };
  }

  if (kind === "social") {
    return {
      target: "social",
      sectionId: "footer",
      title: "Social links",
      path: "settings",
      fields: [
        { kind: "url", key: "social_instagram", label: "Instagram" },
        { kind: "url", key: "social_x", label: "X / Twitter" },
        { kind: "url", key: "social_linkedin", label: "LinkedIn" },
      ],
    };
  }

  if (kind === "header") {
    return {
      target: "header",
      sectionId: "header",
      title: "Header / navigation",
      path: "navigation",
      fields: [
        { kind: "info", text: "Click a nav link in the preview to edit it, or manage links below via Settings." },
      ],
    };
  }

  return null;
}

export const LANDING_NAVIGATOR_SECTIONS = [
  { id: "header", label: "Header", target: "header" },
  { id: "popup", label: "Free trial popup", target: "popup" },
  { id: "hero", label: "Hero", target: "section:hero" },
  { id: "trusted", label: "Trusted strip", target: "section:trusted" },
  { id: "share-portal", label: "QR to AR", target: "section:share-portal" },
  { id: "features", label: "Features", target: "section:features" },
  { id: "usecases", label: "Use cases", target: "section:usecases" },
  { id: "analytics", label: "Analytics", target: "section:analytics" },
  { id: "pricing", label: "Pricing", target: "section:pricing" },
  { id: "faq", label: "FAQ", target: "section:faq" },
  { id: "cta", label: "Final CTA", target: "section:cta" },
  { id: "footer", label: "Footer", target: "footer" },
  { id: "social", label: "Social", target: "social" },
] as const;
