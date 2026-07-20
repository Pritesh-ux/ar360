import { randomBytes } from "crypto";
import { query } from "@/lib/db";
import type { WorkspaceRole } from "./permissions";

export type InviteRow = {
  id: number;
  workspace_uid: string;
  invited_by_user_id: number;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  workspace_name?: string;
  inviter_name?: string;
};

export async function createInvite(params: {
  workspaceUid: string;
  invitedByUserId: number;
  email: string;
  role: WorkspaceRole;
}): Promise<InviteRow> {
  // Revoke any existing pending invite for same email+workspace
  await query(
    `UPDATE workspace_invites SET status = 'revoked'
     WHERE workspace_uid = ? AND email = ? AND status = 'pending'`,
    [params.workspaceUid, params.email.toLowerCase()],
  );

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  await query(
    `INSERT INTO workspace_invites (workspace_uid, invited_by_user_id, email, role, token, status, expires_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [params.workspaceUid, params.invitedByUserId, params.email.toLowerCase(), params.role, token, expiresAt],
  );

  const rows = await query<InviteRow>(
    "SELECT * FROM workspace_invites WHERE token = ? LIMIT 1",
    [token],
  );
  return rows[0];
}

export async function getInviteByToken(token: string): Promise<InviteRow | null> {
  const rows = await query<InviteRow>(
    `SELECT wi.*, w.name AS workspace_name, u.name AS inviter_name
     FROM workspace_invites wi
     JOIN workspaces w ON w.workspace_uid = wi.workspace_uid
     JOIN users u ON u.id = wi.invited_by_user_id
     WHERE wi.token = ? LIMIT 1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function acceptInvite(token: string, userId: number): Promise<void> {
  const invite = await getInviteByToken(token);
  if (!invite || invite.status !== "pending") throw new Error("Invalid or expired invite.");
  if (new Date(invite.expires_at) < new Date()) {
    await query("UPDATE workspace_invites SET status = 'expired' WHERE token = ?", [token]);
    throw new Error("Invite has expired.");
  }

  // Upsert member
  await query(
    `INSERT INTO workspace_members (workspace_uid, user_id, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [invite.workspace_uid, userId, invite.role],
  );

  await query("UPDATE workspace_invites SET status = 'accepted' WHERE token = ?", [token]);
}

export async function revokeInvite(inviteId: number, workspaceUid: string): Promise<void> {
  await query(
    "UPDATE workspace_invites SET status = 'revoked' WHERE id = ? AND workspace_uid = ?",
    [inviteId, workspaceUid],
  );
}

export async function listInvites(workspaceUid: string): Promise<InviteRow[]> {
  return query<InviteRow>(
    `SELECT wi.*, u.name AS inviter_name
     FROM workspace_invites wi
     JOIN users u ON u.id = wi.invited_by_user_id
     WHERE wi.workspace_uid = ?
     ORDER BY wi.created_at DESC`,
    [workspaceUid],
  );
}
