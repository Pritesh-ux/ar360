import { normalizeWhatsAppDigits } from "@/lib/viewer-contact/whatsapp";
import {
  DEFAULT_CONTACT_SETTINGS,
  type ProductContactOverride,
  type ViewerContact,
  type WorkspaceContactSettings,
} from "@/lib/viewer-contact/types";

function labelOrDefault(value: string | null | undefined, fallback: string) {
  const trimmed = String(value || "").trim();
  return trimmed.slice(0, 40) || fallback;
}

export function resolveViewerContact(
  workspace: WorkspaceContactSettings | null | undefined,
  product: ProductContactOverride | null | undefined,
  options?: { planAllowed?: boolean; clientPhone?: string | null },
): ViewerContact {
  const ws = workspace || DEFAULT_CONTACT_SETTINGS;
  const custom = Boolean(product?.contactUseCustom);
  const planAllowed = options?.planAllowed !== false;

  const enquireFlag = custom ? Boolean(product?.contactEnquireEnabled) : Boolean(ws.enquireEnabled);
  const whatsappEnabledFlag = custom
    ? Boolean(product?.contactWhatsappEnabled)
    : Boolean(ws.whatsappEnabled);

  const productNumber = normalizeWhatsAppDigits(product?.contactWhatsappNumber);
  const workspaceNumber = normalizeWhatsAppDigits(ws.whatsappNumber);
  const clientNumber = normalizeWhatsAppDigits(options?.clientPhone);
  const whatsappNumber = clientNumber || (custom ? productNumber || workspaceNumber : workspaceNumber);
  const whatsappOn = clientNumber ? true : whatsappEnabledFlag;
  const enquireOn = enquireFlag || Boolean(clientNumber);

  const enquireLabel = custom
    ? labelOrDefault(product?.contactEnquireLabel, ws.enquireLabel || DEFAULT_CONTACT_SETTINGS.enquireLabel)
    : labelOrDefault(ws.enquireLabel, DEFAULT_CONTACT_SETTINGS.enquireLabel);
  const whatsappLabel = custom
    ? labelOrDefault(product?.contactWhatsappLabel, ws.whatsappLabel || DEFAULT_CONTACT_SETTINGS.whatsappLabel)
    : labelOrDefault(ws.whatsappLabel, DEFAULT_CONTACT_SETTINGS.whatsappLabel);

  return {
    enquireEnabled: enquireOn && planAllowed,
    enquireLabel,
    whatsappEnabled: whatsappOn && Boolean(whatsappNumber) && planAllowed,
    whatsappLabel,
    whatsappNumber,
  };
}

export function readProductContactOverride(source: Record<string, unknown> | null | undefined): ProductContactOverride {
  const settings =
    source?.settings && typeof source.settings === "object" && !Array.isArray(source.settings)
      ? (source.settings as Record<string, unknown>)
      : {};
  const bag = { ...settings, ...(source || {}) };
  return {
    contactUseCustom: Boolean(bag.contactUseCustom),
    contactEnquireEnabled: Boolean(bag.contactEnquireEnabled),
    contactWhatsappEnabled: Boolean(bag.contactWhatsappEnabled),
    contactWhatsappNumber: String(bag.contactWhatsappNumber || ""),
    contactEnquireLabel: String(bag.contactEnquireLabel || ""),
    contactWhatsappLabel: String(bag.contactWhatsappLabel || ""),
  };
}
