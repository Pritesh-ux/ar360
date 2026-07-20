import { query } from "@/lib/db";
import type { WorkspaceRole, Permission } from "./permissions";
import { hasPermission } from "./permissions";

export type RbacContext = {
  userId: number;
  workspaceUid: string;
  role: WorkspaceRole;
};

type MemberRow = { role: WorkspaceRole };

/**
 * Resolve the calling user's role in a workspace.
 * Returns null if the user is not a member.
 */
export async function getWorkspaceRole(
  userId: number,
  workspaceUid: string,
): Promise<WorkspaceRole | null> {
  const rows = await query<MemberRow>(
    `SELECT wm.role FROM workspace_members wm
     WHERE wm.workspace_uid = ? AND wm.user_id = ?
     LIMIT 1`,
    [workspaceUid, userId],
  );
  return rows[0]?.role ?? null;
}

/**
 * Resolve role and assert the user has the required permission.
 * Throws a typed error on failure — callers convert to HTTP 403.
 */
export async function requirePermission(
  userId: number,
  workspaceUid: string,
  permission: Permission,
): Promise<RbacContext> {
  const role = await getWorkspaceRole(userId, workspaceUid);
  if (!role) throw new RbacError("NOT_MEMBER", "You are not a member of this workspace.");
  if (!hasPermission(role, permission)) {
    throw new RbacError("FORBIDDEN", `Missing permission: ${permission}`);
  }
  return { userId, workspaceUid, role };
}

/**
 * Verify workspace membership without checking a specific permission.
 */
export async function requireMembership(
  userId: number,
  workspaceUid: string,
): Promise<RbacContext> {
  const role = await getWorkspaceRole(userId, workspaceUid);
  if (!role) throw new RbacError("NOT_MEMBER", "You are not a member of this workspace.");
  return { userId, workspaceUid, role };
}

/**
 * Verify the workspace belongs to the customer (ownership check).
 */
export async function requireWorkspaceOwnership(
  customerUid: string,
  workspaceUid: string,
): Promise<void> {
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM workspaces
     WHERE workspace_uid = ? AND customer_uid = ? AND status != 'deleted'`,
    [workspaceUid, customerUid],
  );
  if (!Number(rows[0]?.total)) {
    throw new RbacError("NOT_FOUND", "Workspace not found.");
  }
}

export class RbacError extends Error {
  constructor(
    public readonly code: "NOT_MEMBER" | "FORBIDDEN" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "RbacError";
  }
}

export function rbacErrorResponse(err: unknown): Response {
  if (err instanceof RbacError) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return Response.json({ error: err.message }, { status });
  }
  return Response.json({ error: "Internal server error." }, { status: 500 });
}
