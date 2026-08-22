import { query } from "@/lib/db";
import { DEFAULT_LANDING_NAVIGATION } from "@/lib/website/default-navigation";
import { DETAILED_REFUND_POLICY } from "@/lib/website/default-landing-content";

function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

let ensureWebsiteCmsPromise: Promise<void> | null = null;

export async function ensureWebsiteCmsSchema() {
  // Run at most once per process — CREATE + landing sync is expensive and was
  // previously re-executed on every ensureAppSchema() (settings, admin, etc.).
  if (ensureWebsiteCmsPromise) return ensureWebsiteCmsPromise;
  ensureWebsiteCmsPromise = ensureWebsiteCmsSchemaOnce().catch((error) => {
    ensureWebsiteCmsPromise = null;
    throw error;
  });
  return ensureWebsiteCmsPromise;
}

async function ensureWebsiteCmsSchemaOnce() {
  // Production deploy uses migrations; skip repeated DDL. Still soft-sync landing once.
  if (!shouldSkipRuntimeDdl()) {
    await createWebsiteCmsTables();
  }

  try {
    // 13. Seeding Logic (Run once if tables are empty)
    const pagesCount = await query<{ total: number }>("SELECT COUNT(*) total FROM website_pages").then(
      (r) => r[0]?.total || 0,
    );
    if (pagesCount === 0) {
      await seedWebsiteDefaults();
    }

    // Seed default themes if none exist
    const themeCount = await query<{ total: number }>("SELECT COUNT(*) total FROM website_themes").then(
      (r) => r[0]?.total || 0,
    );
    if (themeCount === 0) {
      await seedThemes();
    }

    // Soft-sync landing modifications into CMS (idempotent) — once per process boot
    const { syncWebsiteLandingDefaults } = await import("@/lib/website/sync-landing-defaults");
    await syncWebsiteLandingDefaults();

    const { ensureLandingEditorSchema } = await import("@/lib/website/landing-editor.schema");
    await ensureLandingEditorSchema();
  } catch (error) {
    // Tables may not exist yet on a fresh DB before migrations — don't crash the app.
    if (!shouldSkipRuntimeDdl()) throw error;
    console.warn("[website-cms] ensure skipped/failed (run migrations):", error);
  }
}

async function createWebsiteCmsTables() {
  // 1. Pages & Policies
  await query(`
    CREATE TABLE IF NOT EXISTS website_pages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      page_uid VARCHAR(40) NOT NULL UNIQUE,
      slug VARCHAR(190) NOT NULL UNIQUE,
      title VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wp_slug (slug),
      INDEX idx_wp_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Sections
  await query(`
    CREATE TABLE IF NOT EXISTS website_sections (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      section_uid VARCHAR(40) NOT NULL UNIQUE,
      page_uid VARCHAR(40) NOT NULL,
      section_key VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      subtitle VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT NULL,
      buttons JSON NULL,
      images JSON NULL,
      background VARCHAR(100) NOT NULL DEFAULT 'bg-white',
      visibility BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      glb_model_uid VARCHAR(40) NULL,
      glb_settings JSON NULL,
      style_settings JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ws_page (page_uid),
      INDEX idx_ws_key (section_key),
      INDEX idx_ws_visibility (visibility),
      INDEX idx_ws_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Assets Library
  await query(`
    CREATE TABLE IF NOT EXISTS website_assets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      asset_uid VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      folder VARCHAR(100) NOT NULL DEFAULT '/',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wa_folder (folder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. GLB Models Library
  await query(`
    CREATE TABLE IF NOT EXISTS website_models (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      model_uid VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
      polygon_count INT UNSIGNED NOT NULL DEFAULT 0,
      folder VARCHAR(100) NOT NULL DEFAULT '/',
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wm_default (is_default),
      INDEX idx_wm_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. General Settings
  await query(`
    CREATE TABLE IF NOT EXISTS website_settings (
      setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
      setting_value TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. Navigation Menus
  await query(`
    CREATE TABLE IF NOT EXISTS website_navigation (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nav_uid VARCHAR(40) NOT NULL UNIQUE,
      menu_type ENUM('navbar', 'footer') NOT NULL DEFAULT 'navbar',
      label VARCHAR(100) NOT NULL,
      link_url VARCHAR(255) NOT NULL,
      parent_uid VARCHAR(40) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      icon VARCHAR(50) NULL,
      visibility BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wn_menu (menu_type),
      INDEX idx_wn_visibility (visibility),
      INDEX idx_wn_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 7. SEO Metadata
  await query(`
    CREATE TABLE IF NOT EXISTS website_seo (
      page_uid VARCHAR(40) NOT NULL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      keywords VARCHAR(255) NULL,
      canonical VARCHAR(255) NULL,
      og_image VARCHAR(255) NULL,
      twitter_card VARCHAR(50) NULL DEFAULT 'summary_large_image',
      robots VARCHAR(100) NULL DEFAULT 'index, follow',
      schema_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. Version Snapshots
  await query(`
    CREATE TABLE IF NOT EXISTS website_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      version_uid VARCHAR(40) NOT NULL UNIQUE,
      entity_type VARCHAR(50) NOT NULL,
      entity_uid VARCHAR(40) NOT NULL,
      snapshot LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wv_entity (entity_type, entity_uid),
      INDEX idx_wv_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // =========================================================================
  // EXTENDED WEBSITE BUILDER TABLES
  // =========================================================================

  // 9. Categories
  await query(`
    CREATE TABLE IF NOT EXISTS website_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      category_uid VARCHAR(40) NOT NULL UNIQUE,
      slug VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      icon VARCHAR(50) NULL,
      color VARCHAR(30) NULL,
      description TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      visibility BOOLEAN NOT NULL DEFAULT TRUE,
      deleted_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wcat_visibility (visibility),
      INDEX idx_wcat_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 10. Showcases
  await query(`
    CREATE TABLE IF NOT EXISTS website_showcases (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      showcase_uid VARCHAR(40) NOT NULL UNIQUE,
      category_uid VARCHAR(40) NOT NULL,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      subtitle VARCHAR(255) NULL,
      description TEXT NULL,
      cta_label VARCHAR(100) NULL,
      cta_link VARCHAR(255) NULL,
      glb_model_uid VARCHAR(40) NULL,
      glb_settings JSON NULL,
      image_path VARCHAR(255) NULL,
      benefits JSON NULL,
      style_settings JSON NULL,
      sort_order INT NOT NULL DEFAULT 0,
      visibility BOOLEAN NOT NULL DEFAULT TRUE,
      deleted_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wsh_category (category_uid),
      INDEX idx_wsh_visibility (visibility),
      INDEX idx_wsh_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS website_landing_drafts (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
      document_json LONGTEXT NOT NULL,
      revision INT UNSIGNED NOT NULL DEFAULT 1,
      status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
      updated_by BIGINT UNSIGNED NULL,
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 11. Custom Cards
  await query(`
    CREATE TABLE IF NOT EXISTS website_cards (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      card_uid VARCHAR(40) NOT NULL UNIQUE,
      section_uid VARCHAR(40) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      image_path VARCHAR(255) NULL,
      glb_path VARCHAR(255) NULL,
      button_label VARCHAR(100) NULL,
      button_link VARCHAR(255) NULL,
      features JSON NULL,
      style_settings JSON NULL,
      sort_order INT NOT NULL DEFAULT 0,
      visibility BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wcard_section (section_uid),
      INDEX idx_wcard_visibility (visibility),
      INDEX idx_wcard_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 12. Dynamic Themes
  await query(`
    CREATE TABLE IF NOT EXISTS website_themes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      theme_uid VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      tokens JSON NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wth_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function seedWebsiteDefaults() {
  console.log("Seeding Website CMS tables...");

  // Seed default pages
  const defaultPages = [
    {
      uid: "wp_privacy",
      slug: "privacy",
      title: "Privacy policy",
      content: `<p>Last updated: July 2026</p><p>AR360 Studio (&quot;we&quot;, &quot;us&quot;) provides a SaaS platform for 3D and AR product experiences. This policy describes how we collect, use, and protect information when you use our website and dashboard.</p><h2>Information we collect</h2><ul><li>Account details such as name, email, company, and billing information.</li><li>Product assets and metadata you upload to the platform.</li><li>Viewer analytics such as page views, device type, country, and engagement events.</li><li>Technical logs required for security, abuse prevention, and service reliability.</li></ul><h2>How we use information</h2><ul><li>Provide and improve the AR360 Studio service.</li><li>Process subscriptions and invoices.</li><li>Show analytics dashboards to account owners.</li><li>Detect fraud, enforce plan limits, and protect customer assets.</li></ul><h2>Sharing</h2><p>We do not sell personal data. We use payment processors (such as Razorpay) and infrastructure providers only as needed to operate the service. Viewer analytics may include hashed IP data for abuse prevention.</p><h2>Retention</h2><p>Account data is retained while your subscription is active. Analytics may be trimmed per plan settings. You may request deletion by contacting support.</p><h2>Security</h2><p>We use encrypted sessions, tenant-isolated storage paths, rate limiting, and access controls. No method of transmission over the Internet is 100% secure; we continuously improve our safeguards.</p><h2>Contact</h2><p>Privacy questions: privacy@ar360.studio</p>`,
    },
    {
      uid: "wp_terms",
      slug: "terms",
      title: "Terms of service",
      content: `<p>Last updated: July 2026</p><p>By accessing AR360 Studio you agree to these terms. If you do not agree, do not use the service.</p><h2>Service</h2><p>AR360 Studio provides tools to host 3D models, publish viewers, generate QR/embed links, and view analytics. Features vary by plan and may change as the product evolves.</p><h2>Accounts</h2><p>You are responsible for safeguarding login credentials and for activity under your account. You must provide accurate registration information and comply with applicable laws.</p><h2>Acceptable use</h2><ul><li>Upload only content you have rights to distribute.</li><li>Do not upload malware, illegal content, or material that infringes third-party rights.</li><li>Do not attempt to bypass plan limits, security controls, or other customers&apos; data.</li></ul><h2>Plans &amp; billing</h2><p>Paid plans renew according to the billing cycle selected at checkout unless cancelled. Fees are non-refundable except where required by law or explicitly approved by AR360 Studio support.</p><h2>Availability</h2><p>We aim for high availability but do not guarantee uninterrupted service. Maintenance, third-party outages, or force majeure may cause downtime.</p><h2>Limitation of liability</h2><p>To the maximum extent permitted by law, AR360 Studio is not liable for indirect or consequential damages arising from use of the platform. Our total liability is limited to fees paid in the twelve months before the claim.</p><h2>Contact</h2><p>Legal inquiries: legal@ar360.studio</p>`,
    },
    {
      uid: "wp_refund",
      slug: "refund",
      title: DETAILED_REFUND_POLICY.title,
      content: DETAILED_REFUND_POLICY.content,
    },
    {
      uid: "wp_about",
      slug: "about",
      title: "About Us",
      content: `<h2>About AR360</h2><p>We are a remote-first, customer-obsessed team building next-generation 3D & AR software to enable visual e-commerce at scale.</p>`,
    },
  ];

  for (const page of defaultPages) {
    await query(
      "INSERT INTO website_pages (page_uid, slug, title, content, status) VALUES (?, ?, ?, ?, 'published')",
      [page.uid, page.slug, page.title, page.content]
    );
  }

  // Seed default settings
  const defaultSettings = [
    { key: "company_name", val: "AR360" },
    { key: "support_email", val: "support@ar360.studio" },
    { key: "contact_phone", val: "+91 99999 99999" },
    { key: "contact_email", val: "info@ar360.studio" },
    { key: "gst_number", val: "27AAAAA0000A1Z5" },
    { key: "address", val: "AR360 Studio, Remote, India" },
    { key: "copyright", val: "AR360 Studio. All rights reserved." },
    { key: "social_linkedin", val: "https://linkedin.com" },
    { key: "social_instagram", val: "https://instagram.com" },
    { key: "social_x", val: "https://x.com" },
  ];

  for (const set of defaultSettings) {
    await query(
      "INSERT INTO website_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
      [set.key, set.val]
    );
  }

  // Seed default models
  const defaultModels = [
    { uid: "wm_chair", name: "Default Chair", path: "/models/chair_01.glb", is_default: 1 },
    { uid: "wm_furniture", name: "Furniture Default", path: "/models/use-cases/furniture.glb", is_default: 0 },
    { uid: "wm_tiles", name: "Tiles Default", path: "/models/use-cases/tiles.glb", is_default: 0 },
    { uid: "wm_shoes", name: "Shoes Default", path: "/models/use-cases/shoes.glb", is_default: 0 },
    { uid: "wm_packaging", name: "Packaging Default", path: "/models/use-cases/packaging.glb", is_default: 0 },
    { uid: "wm_electronics", name: "Electronics Default", path: "/models/use-cases/electronics.glb", is_default: 0 },
    { uid: "wm_jewelry", name: "Jewelry Default", path: "/models/use-cases/jewelry.glb", is_default: 0 },
    { uid: "wm_fashion", name: "Fashion Default", path: "/models/use-cases/fashion.glb", is_default: 0 },
    { uid: "wm_automotive", name: "Automotive Default", path: "/models/use-cases/automotive.glb", is_default: 0 },
  ];

  for (const model of defaultModels) {
    await query(
      "INSERT INTO website_models (model_uid, name, file_path, is_default, status) VALUES (?, ?, ?, ?, 'active')",
      [model.uid, model.name, model.path, model.is_default]
    );
  }

  // Seed Industry Use Cases (all 8 homepage tabs)
  const { ensureUseCaseShowcases } = await import("@/lib/website/ensure-use-case-showcases");
  await ensureUseCaseShowcases();

  // Seed default sections for landing page
  const sections = [
    {
      uid: "ws_hero",
      key: "hero",
      title: "Upload once. Sell everywhere.",
      subtitle: "3D · AR · QR commerce",
      desc: "Interactive 3D, browser AR, permanent QR, and website embeds — from one product workspace.",
      buttons: JSON.stringify([
        { label: "Get Started", href: "/signup", style: "primary" },
        { label: "Watch Demo", href: "/demo", style: "secondary" }
      ]),
      bg: "bg-white",
      model: "wm_chair",
      order: 1
    },
    {
      uid: "ws_features",
      key: "features",
      title: "Powerful suite of 3D commerce tools",
      subtitle: "Features",
      desc: "Transform your static product images into immersive experiences in minutes.",
      bg: "bg-[#FAFAFA]",
      order: 2
    },
    {
      uid: "ws_usecases",
      key: "usecases",
      title: "Use Cases",
      subtitle: "Industry fit",
      desc: "AR360 empowers businesses across diverse e-commerce verticals.",
      bg: "bg-white",
      order: 3
    }
  ];

  for (const sec of sections) {
    await query(
      "INSERT INTO website_sections (section_uid, page_uid, section_key, title, subtitle, description, buttons, background, glb_model_uid, sort_order) VALUES (?, 'home', ?, ?, ?, ?, ?, ?, ?, ?)",
      [sec.uid, sec.key, sec.title, sec.subtitle, sec.desc, sec.buttons || null, sec.bg, sec.model || null, sec.order]
    );
  }

  // Seed default navigation links
  for (const nav of DEFAULT_LANDING_NAVIGATION) {
    await query(
      "INSERT INTO website_navigation (nav_uid, menu_type, label, link_url, sort_order) VALUES (?, ?, ?, ?, ?)",
      [nav.uid, nav.type, nav.label, nav.url, nav.order]
    );
  }

  // Seed default cards (FAQ items and How It Works steps)
  const defaultCards = [
    // FAQs
    { uid: "wcard_faq_1", sec: "ws_faq", title: "What file types does AR360 support?", desc: "AR360 natively supports industry-standard GLB and GLTF files. We also manage USDZ linkages for seamless Apple Quick Look previews.", icon: "", order: 1 },
    { uid: "wcard_faq_2", sec: "ws_faq", title: "Does AR360 support mobile AR?", desc: "Yes. Browser-native AR via Apple Quick Look and Google Scene Viewer from a single link — no app installs.", icon: "", order: 2 },
    { uid: "wcard_faq_3", sec: "ws_faq", title: "Does the product QR change after editing?", desc: "No. QR codes and share links are permanent. Edit textures or swap models without reprinting.", icon: "", order: 3 },
    { uid: "wcard_faq_4", sec: "ws_faq", title: "Can I embed products on my website?", desc: "Yes. Embed the interactive 3D viewer on Shopify, WooCommerce, Webflow, Wix, or custom sites with an iframe snippet.", icon: "", order: 4 },
    { uid: "wcard_faq_5", sec: "ws_faq", title: "How is storage calculated?", desc: "Storage is the cumulative size of active uploaded GLB files and custom texture maps in your workspace.", icon: "", order: 5 },
    { uid: "wcard_faq_6", sec: "ws_faq", title: "How is bandwidth calculated?", desc: "Bandwidth is data transferred when visitors rotate models, scan QR codes, load embeds, or launch AR.", icon: "", order: 6 },
    { uid: "wcard_faq_7", sec: "ws_faq", title: "Can I upgrade later?", desc: "Yes. Upgrade or modify your tier instantly from Billing in the Customer Panel.", icon: "", order: 7 },
    { uid: "wcard_faq_8", sec: "ws_faq", title: "Is Object Capture included?", desc: "Yes. Photo-to-3D Object Capture is integrated for compatible devices.", icon: "", order: 8 },

    // How It Works Steps
    { uid: "wcard_how_1", sec: "ws_howitworks", title: "Upload", desc: "Drop a GLB or capture a product.", icon: "Upload", order: 1 },
    { uid: "wcard_how_2", sec: "ws_howitworks", title: "AI Optimize", desc: "Clean meshes and prep for web.", icon: "Sparkles", order: 2 },
    { uid: "wcard_how_3", sec: "ws_howitworks", title: "Customize", desc: "Materials, light, camera, brand.", icon: "Sliders", order: 3 },
    { uid: "wcard_how_4", sec: "ws_howitworks", title: "Publish", desc: "One click to live viewer + QR.", icon: "Rocket", order: 4 },
    { uid: "wcard_how_5", sec: "ws_howitworks", title: "Share", desc: "Link, embed, and print-ready codes.", icon: "Share2", order: 5 },
    { uid: "wcard_how_6", sec: "ws_howitworks", title: "Track", desc: "Views, rotates, scans, AR opens.", icon: "LineChart", order: 6 },
    { uid: "wcard_how_7", sec: "ws_howitworks", title: "Scale", desc: "Grow products without new tools.", icon: "TrendingUp", order: 7 },

    // Features grid (landing FeatureStory)
    { uid: "wcard_feat_1", sec: "ws_features", title: "Universal Embed", desc: "Drop an iframe on any storefront.", icon: "Code", order: 1 },
    { uid: "wcard_feat_2", sec: "ws_features", title: "Permanent QR", desc: "One code for the product lifetime.", icon: "QrCode", order: 2 },
    { uid: "wcard_feat_3", sec: "ws_features", title: "Apple USDZ", desc: "Quick Look ready on iPhone & iPad.", icon: "Apple", order: 3 },
    { uid: "wcard_feat_4", sec: "ws_features", title: "Android Scene Viewer", desc: "Native AR without an app install.", icon: "Smartphone", order: 4 },
    { uid: "wcard_feat_5", sec: "ws_features", title: "GLB Support", desc: "Industry-standard 3D, ready to publish.", icon: "Box", order: 5 },
    { uid: "wcard_feat_6", sec: "ws_features", title: "Drag & Drop Upload", desc: "From file to live viewer in minutes.", icon: "Upload", order: 6 },
    { uid: "wcard_feat_7", sec: "ws_features", title: "Variant Switching", desc: "Colors and finishes buyers can explore.", icon: "Layers", order: 7 },
    { uid: "wcard_feat_8", sec: "ws_features", title: "Lighting Presets", desc: "Studio-grade exposure in one click.", icon: "Sun", order: 8 },
    { uid: "wcard_feat_9", sec: "ws_features", title: "Material Library", desc: "PBR fabrics, metals, and surfaces.", icon: "Palette", order: 9 },
    { uid: "wcard_feat_10", sec: "ws_features", title: "CDN Delivery", desc: "Fast global loads for every scan.", icon: "Globe", order: 10 },
    { uid: "wcard_feat_11", sec: "ws_features", title: "Analytics", desc: "Views, rotates, QR, and AR launches.", icon: "BarChart3", order: 11 },
    { uid: "wcard_feat_12", sec: "ws_features", title: "Commerce Ready", desc: "Built for Shopify and custom carts.", icon: "ShoppingCart", order: 12 },
  ];

  for (const card of defaultCards) {
    await query(
      "INSERT INTO website_cards (card_uid, section_uid, title, description, button_label, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      [card.uid, card.sec, card.title, card.desc, card.icon, card.order]
    );
  }
}

async function seedThemes() {
  console.log("Seeding Website Builder default themes...");
  const themes = [
    {
      uid: "th_default",
      name: "Default Modern Lime",
      is_active: 1,
      tokens: {
        primary: "#B9FF2C",
        secondary: "#111111",
        accent: "#84D400",
        background: "#FFFFFF",
        surface: "#FAFAFA",
        border: "#ECECEC",
        text: "#111111",
        mutedText: "#5C6168",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        radiusCard: "24px",
        radiusBtn: "9999px",
        fontHeading: "Outfit",
        fontBody: "Inter",
        spacingMultiplier: "1"
      }
    },
    {
      uid: "th_luxury",
      name: "Luxury Gold & Black",
      is_active: 0,
      tokens: {
        primary: "#D4AF37",
        secondary: "#0A0A0A",
        accent: "#C59B27",
        background: "#0F0F0F",
        surface: "#1A1A1A",
        border: "#2E2E2E",
        text: "#F5F5F5",
        mutedText: "#A0A0A0",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        radiusCard: "12px",
        radiusBtn: "4px",
        fontHeading: "Cinzel",
        fontBody: "Montserrat",
        spacingMultiplier: "1.1"
      }
    },
    {
      uid: "th_minimal",
      name: "Minimalist Slate",
      is_active: 0,
      tokens: {
        primary: "#334155",
        secondary: "#0F172A",
        accent: "#475569",
        background: "#F8FAFC",
        surface: "#FFFFFF",
        border: "#F1F5F9",
        text: "#0F172A",
        mutedText: "#64748B",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
        radiusCard: "8px",
        radiusBtn: "8px",
        fontHeading: "Inter",
        fontBody: "Inter",
        spacingMultiplier: "0.9"
      }
    }
  ];

  for (const th of themes) {
    await query(
      "INSERT INTO website_themes (theme_uid, name, tokens, is_active) VALUES (?, ?, ?, ?)",
      [th.uid, th.name, JSON.stringify(th.tokens), th.is_active]
    );
  }
}
