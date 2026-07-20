import { query } from "@/lib/db";
import { createHmac } from "crypto";

export type AuditAction =
  | "product.created" | "product.updated" | "product.deleted"
  | "product.published" | "product.unpublished"
  | "asset.uploaded" | "asset.deleted"
  | "member.invited" | "member.removed" | "member.role_changed"
  | "billing.changed"
  | "api_key.created" | "api_key.revoked"
  | "webhook.created" | "webhook.deleted"
  | "settings.changed"
  | "branding.changed"
  | "domain.added" | "domain.verified" | "domain.removed"
  | "version.restored"
  | "auth.login" | "auth.failed_permission"
  | "workspace.created";

export type AuditLogRow = {
  id: number;
  workspace_uid: string;
  customer_uid: string;
  user_id: number | null;
  actor_name: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_label: string;
  meta: string | null;
  ip_hash: string;
  created_at: string;
};

function hashIp(ip: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "dev-secret")
    .update(ip)
    .digest("hex")
    .slice(0, 16);
}

export async function writeAuditLog(params: {
  workspaceUid: string;
  customerUid: string;
  userId?: number | null;
  actorName: string;
  actorEmail: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  resourceLabel?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (workspace_uid, customer_uid, user_id, actor_name, actor_email,
          action, resource_type, resource_id, resource_label, meta, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.workspaceUid,
        params.customerUid,
        params.userId ?? null,
        params.actorName,
        params.actorEmail,
        params.action,
        params.resourceType ?? "",
        params.resourceId ?? "",
        params.resourceLabel ?? "",
        params.meta ? JSON.stringify(params.meta) : null,
        params.ip ? hashIp(params.ip) : "",
      ],
    );
  } catch {
    // Audit log failures must never break the main flow
  }
}

export type AuditFilter = {
  workspaceUid: string;
  userId?: number;
  action?: string;
  resourceId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export async function getAuditLogs(filter: AuditFilter): Promise<AuditLogRow[]> {
  const conditions: string[] = ["workspace_uid = ?"];
  const vals: (string | number)[] = [filter.workspaceUid];

  if (filter.userId) { conditions.push("user_id = ?"); vals.push(filter.userId); }
  if (filter.action) { conditions.push("action = ?"); vals.push(filter.action); }
  if (filter.resourceId) { conditions.push("resource_id = ?"); vals.push(filter.resourceId); }
  if (filter.from) { conditions.push("created_at >= ?"); vals.push(filter.from); }
  if (filter.to) { conditions.push("created_at <= ?"); vals.push(filter.to); }

  const limit = Math.min(filter.limit ?? 50, 200);
  const offset = filter.offset ?? 0;

  return query<AuditLogRow>(
    `SELECT * FROM audit_logs WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    vals,
  );
}

export async function countAuditLogs(filter: AuditFilter): Promise<number> {
  const conditions: string[] = ["workspace_uid = ?"];
  const vals: (string | number)[] = [filter.workspaceUid];

  if (filter.userId) { conditions.push("user_id = ?"); vals.push(filter.userId); }
  if (filter.action) { conditions.push("action = ?"); vals.push(filter.action); }
  if (filter.resourceId) { conditions.push("resource_id = ?"); vals.push(filter.resourceId); }
  if (filter.from) { conditions.push("created_at >= ?"); vals.push(filter.from); }
  if (filter.to) { conditions.push("created_at <= ?"); vals.push(filter.to); }

  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM audit_logs WHERE ${conditions.join(" AND ")}`,
    vals,
  );
  return Number(rows[0]?.total ?? 0);
}
