import { query } from "@/lib/db";
import { DEFAULT_LANDING_NAVIGATION } from "@/lib/website/default-navigation";
import {
  DETAILED_REFUND_POLICY,
  LANDING_ANALYTICS_CARDS,
  LANDING_FEATURE_CARDS,
  LANDING_HOME_SECTIONS,
  LANDING_SHARE_PORTAL_STEPS,
  LANDING_TRUSTED_CARDS,
} from "@/lib/website/default-landing-content";

/**
 * Idempotent sync so existing DBs pick up landing modifications
 * (QR to AR nav, detailed refund, trusted/analytics/cta, socials, curated features).
 */
export async function syncWebsiteLandingDefaults() {
  // Social settings (insert only if missing — don't overwrite admin values)
  const socialDefaults = [
    ["social_instagram", "https://instagram.com"],
    ["social_x", "https://x.com"],
    ["social_linkedin", "https://linkedin.com"],
    ["address", "AR360 Studio, Remote, India"],
    ["support_email", "support@ar360.studio"],
    ["contact_email", "info@ar360.studio"],
    ["company_name", "AR360"],
    ["copyright", "AR360 Studio. All rights reserved."],
    // Landing free-trial popup copy (insert-only — admin edits win).
    // `*word*` renders in the lime accent colour.
    ["free_trial_popup_badge", "Limited time offer"],
    ["free_trial_popup_title", "Try *AR360* Studio\n*FREE* for 7 Days!"],
    [
      "free_trial_popup_description",
      "Create immersive 3D and browser AR product experiences in minutes. *No credit card required.*",
    ],
    ["free_trial_popup_primary_label", "Start free trial"],
    ["free_trial_popup_secondary_label", "See how it works"],
    ["free_trial_popup_scan_title", "Scan to experience"],
    ["free_trial_popup_scan_note", "Browser AR · No app"],
  ];
  for (const [key, val] of socialDefaults) {
    await query(
      `INSERT INTO website_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_key = setting_key`,
      [key, val]
    );
  }

  // Demo → QR to AR
  await query(
    `UPDATE website_navigation
     SET nav_uid = 'wn_qr_ar',
         label = 'QR to AR',
         link_url = '/#share-portal',
         sort_order = 2
     WHERE menu_type = 'navbar'
       AND (
         nav_uid = 'wn_demo'
         OR LOWER(label) = 'demo'
         OR link_url = '/demo'
         OR link_url LIKE '%editor-story%'
       )`
  );

  // Ensure full default nav exists
  for (const nav of DEFAULT_LANDING_NAVIGATION) {
    await query(
      `INSERT INTO website_navigation (nav_uid, menu_type, label, link_url, sort_order, visibility)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         menu_type = VALUES(menu_type),
         label = VALUES(label),
         link_url = VALUES(link_url),
         sort_order = VALUES(sort_order),
         visibility = 1`,
      [nav.uid, nav.type, nav.label, nav.url, nav.order]
    );
  }

  // Detailed refund page (always keep published detailed policy in sync with landing)
  await query(
    `INSERT INTO website_pages (page_uid, slug, title, content, status)
     VALUES ('wp_refund', 'refund', ?, ?, 'published')
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       content = VALUES(content),
       status = 'published',
       slug = 'refund'`,
    [DETAILED_REFUND_POLICY.title, DETAILED_REFUND_POLICY.content]
  );

  // Ensure about exists
  await query(
    `INSERT INTO website_pages (page_uid, slug, title, content, status)
     VALUES ('wp_about', 'about', 'About Us',
       '<h2>About AR360</h2><p>We are a remote-first team building 3D &amp; AR commerce tools so brands can upload once and sell everywhere.</p>',
       'published')
     ON DUPLICATE KEY UPDATE page_uid = page_uid`
  );

  // Home sections used by live landing — insert if missing; never overwrite admin copy
  for (const sec of LANDING_HOME_SECTIONS) {
    await query(
      `INSERT INTO website_sections
        (section_uid, page_uid, section_key, title, subtitle, description, buttons, background, sort_order, visibility)
       VALUES (?, 'home', ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         section_key = VALUES(section_key),
         sort_order = VALUES(sort_order)`,
      [
        sec.uid,
        sec.key,
        sec.title,
        sec.subtitle,
        sec.desc,
        "buttons" in sec ? sec.buttons : null,
        sec.bg,
        sec.order,
      ]
    );
  }

  // Also ensure hero/features/usecases exist with canonical keys
  const coreSections = [
    {
      uid: "ws_hero",
      key: "hero",
      title: "Upload once. Sell everywhere.",
      subtitle: "3D · AR · QR commerce",
      desc: "Interactive 3D, browser AR, permanent QR, and website embeds — from one product workspace.",
      buttons: JSON.stringify([
        { label: "Get Started", href: "/signup", style: "primary" },
        { label: "Watch Demo", href: "/demo", style: "secondary" },
      ]),
      order: 1,
    },
    {
      uid: "ws_features",
      key: "features",
      title: "Simple tools to sell in 3D & AR.",
      subtitle: "Features",
      desc: "Transform static product images into immersive experiences.",
      buttons: null,
      order: 2,
    },
    {
      uid: "ws_usecases",
      key: "usecases",
      title: "Built for every product category.",
      subtitle: "Use cases",
      desc: "AR360 empowers businesses across diverse e-commerce verticals.",
      buttons: null,
      order: 3,
    },
  ];
  for (const sec of coreSections) {
    await query(
      `INSERT INTO website_sections
        (section_uid, page_uid, section_key, title, subtitle, description, buttons, background, sort_order, visibility)
       VALUES (?, 'home', ?, ?, ?, ?, ?, 'bg-transparent', ?, 1)
       ON DUPLICATE KEY UPDATE section_key = VALUES(section_key), sort_order = VALUES(sort_order)`,
      [sec.uid, sec.key, sec.title, sec.subtitle, sec.desc, sec.buttons, sec.order]
    );
  }

  // Share portal step cards
  for (const card of LANDING_SHARE_PORTAL_STEPS) {
    await query(
      `INSERT INTO website_cards (card_uid, section_uid, title, description, button_label, sort_order, visibility)
       VALUES (?, 'ws_share_portal', ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         section_uid = 'ws_share_portal',
         sort_order = VALUES(sort_order)`,
      [card.uid, card.title, card.desc, card.icon, card.order]
    );
    // Store step label in button_link when empty (non-destructive)
    await query(
      `UPDATE website_cards SET button_link = COALESCE(NULLIF(button_link, ''), ?)
       WHERE card_uid = ? AND (button_link IS NULL OR button_link = '')`,
      [card.label, card.uid]
    );
  }

  // Trusted strip cards — insert only
  for (const card of LANDING_TRUSTED_CARDS) {
    await query(
      `INSERT INTO website_cards (card_uid, section_uid, title, description, button_label, sort_order, visibility)
       VALUES (?, 'ws_trusted', ?, '', '', ?, 1)
       ON DUPLICATE KEY UPDATE section_uid = 'ws_trusted', sort_order = VALUES(sort_order)`,
      [card.uid, card.title, card.order]
    );
  }

  // Analytics stat cards
  for (const card of LANDING_ANALYTICS_CARDS) {
    await query(
      `INSERT INTO website_cards (card_uid, section_uid, title, description, button_label, sort_order, visibility)
       VALUES (?, 'ws_analytics', ?, ?, '', ?, 1)
       ON DUPLICATE KEY UPDATE section_uid = 'ws_analytics', sort_order = VALUES(sort_order)`,
      [card.uid, card.title, card.desc, card.order]
    );
  }

  // Curated 6 feature cards
  for (const card of LANDING_FEATURE_CARDS) {
    await query(
      `INSERT INTO website_cards (card_uid, section_uid, title, description, button_label, sort_order, visibility)
       VALUES (?, 'ws_features', ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE section_uid = 'ws_features', sort_order = VALUES(sort_order)`,
      [card.uid, card.title, card.desc, card.icon, card.order]
    );
  }

  // Hide legacy extra feature cards not in curated set (keep data, don't show on landing)
  const keep = LANDING_FEATURE_CARDS.map((c) => c.uid);
  const placeholders = keep.map(() => "?").join(",");
  await query(
    `UPDATE website_cards
     SET sort_order = sort_order + 100
     WHERE section_uid = 'ws_features'
       AND card_uid NOT IN (${placeholders})
       AND sort_order < 100`,
    keep
  );
}
