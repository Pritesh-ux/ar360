import { randomBytes } from "crypto";
import { query } from "@/lib/db";

export type WorkspaceRow = {
  id: number;
  workspace_uid: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string | null;
  brand_name: string | null;
  accent_color: string | null;
  viewer_watermark: boolean;
  remove_branding: boolean;
  custom_viewer_theme: string | null;
  viewer_tagline?: string | null;
  cta_label?: string | null;
  website_url?: string | null;
  loading_message?: string | null;
  button_style?: string | null;
  header_style?: string | null;
  viewer_font?: string | null;
  favicon_url?: string | null;
  show_product_title?: boolean | number | null;
  hide_interaction_hint?: boolean | number | null;
  powered_by_label?: string | null;
  owner_user_id: number;
  customer_uid: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMemberRow = {
  user_id: number;
  workspace_uid: string;
  role: string;
  name: string;
  email: string;
  joined_at: string;
};

function generateWorkspaceUid(): string {
  return `WS_${randomBytes(6).toString("hex").toUpperCase()}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base);
  let suffix = 0;
  for (;;) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const rows = await query<{ total: number }>(
      "SELECT COUNT(*) AS total FROM workspaces WHERE slug = ?",
      [candidate],
    );
    if (!Number(rows[0]?.total)) return candidate;
    suffix += 1;
  }
}

export async function createWorkspace(params: {
  name: string;
  ownerUserId: number;
  customerUid: string;
  plan?: string;
}): Promise<WorkspaceRow> {
  const uid = generateWorkspaceUid();
  const slug = await uniqueSlug(params.name);

  await query(
    `INSERT INTO workspaces (workspace_uid, name, slug, owner_user_id, customer_uid, plan, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [uid, params.name, slug, params.ownerUserId, params.customerUid, params.plan ?? "starter"],
  );

  // Auto-add owner as member
  await query(
    `INSERT INTO workspace_members (workspace_uid, user_id, role) VALUES (?, ?, 'owner')`,
    [uid, params.ownerUserId],
  );

  const rows = await query<WorkspaceRow>(
    "SELECT * FROM workspaces WHERE workspace_uid = ? LIMIT 1",
    [uid],
  );
  return rows[0];
}

export async function getWorkspaceByUid(workspaceUid: string): Promise<WorkspaceRow | null> {
  const rows = await query<WorkspaceRow>(
    "SELECT * FROM workspaces WHERE workspace_uid = ? AND status != 'deleted' LIMIT 1",
    [workspaceUid],
  );
  return rows[0] ?? null;
}

export async function getWorkspacesForCustomer(customerUid: string): Promise<WorkspaceRow[]> {
  return query<WorkspaceRow>(
    "SELECT * FROM workspaces WHERE customer_uid = ? AND status != 'deleted' ORDER BY created_at ASC",
    [customerUid],
  );
}

export async function getWorkspacesForUser(userId: number): Promise<WorkspaceRow[]> {
  return query<WorkspaceRow>(
    `SELECT w.* FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_uid = w.workspace_uid
     WHERE wm.user_id = ? AND w.status != 'deleted'
     ORDER BY w.created_at ASC`,
    [userId],
  );
}

export async function updateWorkspace(
  workspaceUid: string,
  fields: Partial<{
    name: string;
    logo_url: string;
    brand_color: string;
    brand_name: string;
    accent_color: string;
    viewer_watermark: boolean;
    remove_branding: boolean;
    custom_viewer_theme: string;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const vals: (string | number | boolean | null)[] = [];

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(v as string | number | boolean | null);
    }
  }
  if (!sets.length) return;
  vals.push(workspaceUid);
  await query(`UPDATE workspaces SET ${sets.join(", ")} WHERE workspace_uid = ?`, vals);
}

export async function getWorkspaceMembers(workspaceUid: string): Promise<WorkspaceMemberRow[]> {
  return query<WorkspaceMemberRow>(
    `SELECT wm.user_id, wm.workspace_uid, wm.role, u.name, u.email, wm.joined_at
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_uid = ?
     ORDER BY wm.joined_at ASC`,
    [workspaceUid],
  );
}

export async function removeMember(workspaceUid: string, userId: number): Promise<void> {
  await query(
    "DELETE FROM workspace_members WHERE workspace_uid = ? AND user_id = ?",
    [workspaceUid, userId],
  );
}

export async function changeMemberRole(
  workspaceUid: string,
  userId: number,
  role: string,
): Promise<void> {
  await query(
    "UPDATE workspace_members SET role = ? WHERE workspace_uid = ? AND user_id = ?",
    [role, workspaceUid, userId],
  );
}

export async function ensureDefaultWorkspace(params: {
  userId: number;
  customerUid: string;
  name: string;
  plan?: string;
}): Promise<WorkspaceRow> {
  const existing = await query<WorkspaceRow>(
    `SELECT w.* FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_uid = w.workspace_uid
     WHERE wm.user_id = ? AND w.customer_uid = ? AND w.status != 'deleted'
     LIMIT 1`,
    [params.userId, params.customerUid],
  );
  if (existing[0]) return existing[0];
  return createWorkspace({
    name: params.name,
    ownerUserId: params.userId,
    customerUid: params.customerUid,
    plan: params.plan,
  });
}
