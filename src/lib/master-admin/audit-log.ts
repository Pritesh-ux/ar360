import { query } from "@/lib/db";

export async function writeMasterAdminAudit(input: {
  adminId?: string | number | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await query(
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
    );
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
