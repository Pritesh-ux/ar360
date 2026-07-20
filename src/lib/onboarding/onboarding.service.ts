import { randomBytes } from "crypto";
import { query } from "@/lib/db";

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "skipped";

export type CustomerOnboarding = {
  customerUid: string;
  status: OnboardingStatus;
  currentStep: number;
  completedAt: string | null;
  skippedAt: string | null;
  businessType: string | null;
  primaryGoal: string | null;
  secondaryGoals: string[];
  preferredCreationMethod: string | null;
  sampleProductCreated: boolean;
  sampleProductId: string | null;
  checklistDismissedAt: string | null;
};

type Row = {
  customer_uid: string;
  status: OnboardingStatus;
  current_step: number;
  completed_at: Date | string | null;
  skipped_at: Date | string | null;
  business_type: string | null;
  primary_goal: string | null;
  secondary_goals_json: string | null;
  preferred_creation_method: string | null;
  sample_product_created: 0 | 1 | boolean;
  sample_product_id: string | null;
  checklist_dismissed_at: Date | string | null;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseGoals(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapRow(row: Row): CustomerOnboarding {
  return {
    customerUid: row.customer_uid,
    status: row.status,
    currentStep: Number(row.current_step || 1),
    completedAt: toIso(row.completed_at),
    skippedAt: toIso(row.skipped_at),
    businessType: row.business_type,
    primaryGoal: row.primary_goal,
    secondaryGoals: parseGoals(row.secondary_goals_json),
    preferredCreationMethod: row.preferred_creation_method,
    sampleProductCreated: Boolean(row.sample_product_created),
    sampleProductId: row.sample_product_id,
    checklistDismissedAt: toIso(row.checklist_dismissed_at),
  };
}

export async function ensureOnboardingSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS customer_onboarding (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      customer_uid VARCHAR(64) NOT NULL,
      status ENUM('not_started','in_progress','completed','skipped') NOT NULL DEFAULT 'not_started',
      current_step TINYINT UNSIGNED NOT NULL DEFAULT 1,
      completed_at DATETIME NULL,
      skipped_at DATETIME NULL,
      business_type VARCHAR(80) NULL,
      primary_goal VARCHAR(120) NULL,
      secondary_goals_json JSON NULL,
      preferred_creation_method VARCHAR(40) NULL,
      sample_product_created TINYINT(1) NOT NULL DEFAULT 0,
      sample_product_id VARCHAR(160) NULL,
      checklist_dismissed_at DATETIME NULL,
      signup_source VARCHAR(40) NOT NULL DEFAULT 'signup',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_customer_onboarding_customer (customer_uid),
      INDEX idx_onboarding_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_website VARCHAR(255) NULL");
  } catch {
    // optional column on older MySQL
  }
}

export function isOnboardingComplete(state: CustomerOnboarding | null) {
  if (!state) return true;
  return state.status === "completed" || state.status === "skipped";
}

export async function getCustomerOnboarding(customerUid: string): Promise<CustomerOnboarding | null> {
  await ensureOnboardingSchema();
  const rows = await query<Row>(
    `SELECT customer_uid, status, current_step, completed_at, skipped_at, business_type, primary_goal,
            secondary_goals_json, preferred_creation_method, sample_product_created, sample_product_id,
            checklist_dismissed_at
       FROM customer_onboarding WHERE customer_uid = ? LIMIT 1`,
    [customerUid],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function initializeCustomerOnboarding(customerUid: string, source = "signup") {
  await ensureOnboardingSchema();
  const uid = `onb_${Date.now()}_${randomBytes(4).toString("hex")}`;
  await query(
    `INSERT INTO customer_onboarding (customer_uid, status, current_step, signup_source)
     VALUES (?, 'not_started', 1, ?)
     ON DUPLICATE KEY UPDATE customer_uid = customer_uid`,
    [customerUid, source],
  );
  return getCustomerOnboarding(customerUid);
}

export async function updateCustomerOnboarding(
  customerUid: string,
  patch: Partial<{
    status: OnboardingStatus;
    currentStep: number;
    businessType: string | null;
    primaryGoal: string | null;
    secondaryGoals: string[];
    preferredCreationMethod: string | null;
    sampleProductCreated: boolean;
    sampleProductId: string | null;
    checklistDismissed: boolean;
    completed: boolean;
    skipped: boolean;
  }>,
) {
  await ensureOnboardingSchema();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (patch.status) {
    sets.push("status = ?");
    values.push(patch.status);
  }
  if (patch.currentStep != null) {
    sets.push("current_step = ?");
    values.push(patch.currentStep);
  }
  if (patch.businessType !== undefined) {
    sets.push("business_type = ?");
    values.push(patch.businessType);
  }
  if (patch.primaryGoal !== undefined) {
    sets.push("primary_goal = ?");
    values.push(patch.primaryGoal);
  }
  if (patch.secondaryGoals !== undefined) {
    sets.push("secondary_goals_json = ?");
    values.push(JSON.stringify(patch.secondaryGoals));
  }
  if (patch.preferredCreationMethod !== undefined) {
    sets.push("preferred_creation_method = ?");
    values.push(patch.preferredCreationMethod);
  }
  if (patch.sampleProductCreated !== undefined) {
    sets.push("sample_product_created = ?");
    values.push(patch.sampleProductCreated ? 1 : 0);
  }
  if (patch.sampleProductId !== undefined) {
    sets.push("sample_product_id = ?");
    values.push(patch.sampleProductId);
  }
  if (patch.checklistDismissed) {
    sets.push("checklist_dismissed_at = NOW()");
  }
  if (patch.completed) {
    sets.push("status = 'completed', completed_at = NOW(), current_step = 5");
  }
  if (patch.skipped) {
    sets.push("status = 'skipped', skipped_at = NOW()");
  }

  if (!sets.length) return getCustomerOnboarding(customerUid);

  values.push(customerUid);
  await query(`UPDATE customer_onboarding SET ${sets.join(", ")}, updated_at = NOW() WHERE customer_uid = ?`, values);
  return getCustomerOnboarding(customerUid);
}

export async function markOnboardingStarted(customerUid: string) {
  const current = await getCustomerOnboarding(customerUid);
  if (!current) await initializeCustomerOnboarding(customerUid);
  if (current?.status === "completed" || current?.status === "skipped") return current;
  return updateCustomerOnboarding(customerUid, { status: "in_progress", currentStep: Math.max(current?.currentStep || 1, 1) });
}
