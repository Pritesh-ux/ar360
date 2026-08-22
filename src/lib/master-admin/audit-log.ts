import { query } from "@/lib/db";

function shouldSkipRuntimeDdl(): boolean {
  const flag = process.env.SKIP_RUNTIME_DDL?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "production";
}

let ensureAuditTablePromise: Promise<void> | null = null;

async function ensureAuditTable() {
  if (shouldSkipRuntimeDdl()) return;
  if (ensureAuditTablePromise) return ensureAuditTablePromise;
  ensureAuditTablePromise = query(
    `CREATE TABLE IF NOT EXISTS master_admin_audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        admin_id VARCHAR(128) NULL,
        action VARCHAR(120) NOT NULL,
        entity_type VARCHAR(80) NOT NULL,
        entity_id VARCHAR(120) NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_master_admin_audit_entity (entity_type, entity_id),
        INDEX idx_master_admin_audit_action (action),
        INDEX idx_master_admin_audit_created (created_at)
      )`,
  ).then(() => undefined).catch((error) => {
    ensureAuditTablePromise = null;
    throw error;
  });
  return ensureAuditTablePromise;
}

export async function writeMasterAdminAudit(input: {
  adminId?: string | number | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await ensureAuditTable();
    await query(
      `INSERT INTO master_admin_audit_logs (admin_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(input.adminId || ""),
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.metadata || {}),
      ],
    );
  } catch (error) {
    console.warn("[master-admin audit skipped]", error);
  }
}
