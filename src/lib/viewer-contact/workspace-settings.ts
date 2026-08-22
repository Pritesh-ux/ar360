import { query } from "@/lib/db";
import { normalizeWhatsAppDigits } from "@/lib/viewer-contact/whatsapp";
import {
  DEFAULT_CONTACT_SETTINGS,
  type WorkspaceContactSettings,
} from "@/lib/viewer-contact/types";

type WorkspaceContactRow = {
  workspace_uid: string;
  contact_whatsapp_number?: string | null;
  contact_whatsapp_enabled?: number | boolean | null;
  contact_enquire_enabled?: number | boolean | null;
  contact_enquire_label?: string | null;
  contact_whatsapp_label?: string | null;
};

function mapRow(row: WorkspaceContactRow | undefined): WorkspaceContactSettings {
  if (!row) return { ...DEFAULT_CONTACT_SETTINGS };
  return {
    whatsappNumber: String(row.contact_whatsapp_number || ""),
    whatsappEnabled: Boolean(row.contact_whatsapp_enabled),
    enquireEnabled: Boolean(row.contact_enquire_enabled),
    enquireLabel: String(row.contact_enquire_label || "").trim() || DEFAULT_CONTACT_SETTINGS.enquireLabel,
    whatsappLabel: String(row.contact_whatsapp_label || "").trim() || DEFAULT_CONTACT_SETTINGS.whatsappLabel,
  };
}

export async function getDefaultWorkspaceUid(customerUid: string): Promise<string | null> {
  const rows = await query<{ workspace_uid: string }>(
    `SELECT workspace_uid FROM workspaces
      WHERE customer_uid = ? AND status != 'deleted'
      ORDER BY created_at ASC
      LIMIT 1`,
    [customerUid],
  ).catch(() => []);
  return rows[0]?.workspace_uid || null;
}

export async function getWorkspaceContactSettings(
  customerUid: string,
): Promise<{ workspaceUid: string | null; settings: WorkspaceContactSettings }> {
  const rows = await query<WorkspaceContactRow>(
    `SELECT workspace_uid, contact_whatsapp_number, contact_whatsapp_enabled,
            contact_enquire_enabled, contact_enquire_label, contact_whatsapp_label
       FROM workspaces
      WHERE customer_uid = ? AND status != 'deleted'
      ORDER BY created_at ASC
      LIMIT 1`,
    [customerUid],
  ).catch(() => []);
  return { workspaceUid: rows[0]?.workspace_uid || null, settings: mapRow(rows[0]) };
}

export async function updateWorkspaceContactSettings(
  workspaceUid: string,
  customerUid: string,
  patch: Partial<WorkspaceContactSettings>,
): Promise<WorkspaceContactSettings> {
  const current = await query<WorkspaceContactRow>(
    `SELECT workspace_uid, contact_whatsapp_number, contact_whatsapp_enabled,
            contact_enquire_enabled, contact_enquire_label, contact_whatsapp_label
       FROM workspaces
      WHERE workspace_uid = ? AND customer_uid = ? AND status != 'deleted'
      LIMIT 1`,
    [workspaceUid, customerUid],
  );
  if (!current[0]) throw new Error("Workspace not found.");

  const next: WorkspaceContactSettings = {
    ...mapRow(current[0]),
    ...patch,
  };
  if (patch.whatsappNumber !== undefined) {
    const digits = normalizeWhatsAppDigits(patch.whatsappNumber);
    next.whatsappNumber = digits ? String(patch.whatsappNumber).trim() : "";
    if (String(patch.whatsappNumber || "").trim() && !digits) {
      throw new Error("Enter a valid WhatsApp number with country code.");
    }
  }
  if (patch.enquireLabel !== undefined) {
    next.enquireLabel = String(patch.enquireLabel || "").trim().slice(0, 40) || DEFAULT_CONTACT_SETTINGS.enquireLabel;
  }
  if (patch.whatsappLabel !== undefined) {
    next.whatsappLabel = String(patch.whatsappLabel || "").trim().slice(0, 40) || DEFAULT_CONTACT_SETTINGS.whatsappLabel;
  }

  await query(
    `UPDATE workspaces
        SET contact_whatsapp_number = ?,
            contact_whatsapp_enabled = ?,
            contact_enquire_enabled = ?,
            contact_enquire_label = ?,
            contact_whatsapp_label = ?
      WHERE workspace_uid = ? AND customer_uid = ?`,
    [
      next.whatsappNumber || null,
      next.whatsappEnabled ? 1 : 0,
      next.enquireEnabled ? 1 : 0,
      next.enquireLabel,
      next.whatsappLabel,
      workspaceUid,
      customerUid,
    ],
  );
  return next;
}
