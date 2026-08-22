export type DefaultNavSeed = {
  uid: string;
  type: "navbar" | "footer";
  label: string;
  url: string;
  order: number;
};

/** Landing page navbar — matches LandingHeader defaultNavItems. */
export const DEFAULT_LANDING_NAVBAR: DefaultNavSeed[] = [
  { uid: "wn_home", type: "navbar", label: "Home", url: "/#hero", order: 1 },
  { uid: "wn_qr_ar", type: "navbar", label: "QR to AR", url: "/#share-portal", order: 2 },
  { uid: "wn_feat", type: "navbar", label: "Features", url: "/#feature-storytelling", order: 3 },
  { uid: "wn_use", type: "navbar", label: "Use Cases", url: "/#use-cases", order: 4 },
  { uid: "wn_price", type: "navbar", label: "Pricing", url: "/#pricing", order: 5 },
  { uid: "wn_faq", type: "navbar", label: "FAQ", url: "/#faq", order: 6 },
];

export const DEFAULT_LANDING_FOOTER: DefaultNavSeed[] = [
  { uid: "wn_foot_contact", type: "footer", label: "Contact", url: "/contact", order: 1 },
  { uid: "wn_foot_privacy", type: "footer", label: "Privacy", url: "/privacy", order: 2 },
  { uid: "wn_foot_terms", type: "footer", label: "Terms", url: "/terms", order: 3 },
  { uid: "wn_foot_refund", type: "footer", label: "Refunds", url: "/refund", order: 4 },
];

export const DEFAULT_LANDING_NAVIGATION: DefaultNavSeed[] = [
  ...DEFAULT_LANDING_NAVBAR,
  ...DEFAULT_LANDING_FOOTER,
];

export function toNavEditorItems(seeds: DefaultNavSeed[]) {
  return seeds.map((item) => ({
    nav_uid: item.uid,
    menu_type: item.type,
    label: item.label,
    link_url: item.url,
    sort_order: item.order,
  }));
}
