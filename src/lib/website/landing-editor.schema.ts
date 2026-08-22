import { query } from "@/lib/db";

let ensurePromise: Promise<void> | null = null;

function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

async function columnExists(table: string, column: string) {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return Number(rows[0]?.total || 0) > 0;
}

async function addColumnIfMissing(table: string, column: string, definition: string) {
  if (shouldSkipRuntimeDdl()) return;
  if (await columnExists(table, column)) return;
  await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

/** Ensure draft + style/media columns exist (dev/runtime; prod uses migrations). */
export async function ensureLandingEditorSchema() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = runEnsure().catch((error) => {
    ensurePromise = null;
    throw error;
  });
  return ensurePromise;
}

async function runEnsure() {
  if (!shouldSkipRuntimeDdl()) {
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await addColumnIfMissing("website_showcases", "image_path", "VARCHAR(255) NULL AFTER glb_settings");
    await addColumnIfMissing("website_showcases", "benefits", "JSON NULL AFTER image_path");
    await addColumnIfMissing("website_showcases", "style_settings", "JSON NULL AFTER benefits");
    await addColumnIfMissing("website_showcases", "deleted_at", "DATETIME NULL AFTER visibility");
    await addColumnIfMissing("website_sections", "style_settings", "JSON NULL AFTER glb_settings");
    await addColumnIfMissing("website_cards", "style_settings", "JSON NULL AFTER features");
    await addColumnIfMissing("website_categories", "deleted_at", "DATETIME NULL AFTER visibility");
  }

  // Soft-seed popup image keys without overwriting admin edits.
  for (const [key, val] of [
    ["free_trial_popup_phone_image", "/home/free-trial-ar-phone.png"],
    ["free_trial_popup_phone_image_mobile", "/home/free-trial-ar-phone.png"],
    ["free_trial_popup_visible", "1"],
    ["free_trial_popup_primary_href", "/signup"],
    ["free_trial_popup_secondary_href", "#how-it-works"],
  ] as const) {
    await query(
      `INSERT INTO website_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = setting_value`,
      [key, val],
    ).catch(() => undefined);
  }
}
