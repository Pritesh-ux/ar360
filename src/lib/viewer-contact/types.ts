export type EnquiryStatus = "new" | "contacted" | "converted" | "closed";

export type WorkspaceContactSettings = {
  whatsappNumber: string;
  whatsappEnabled: boolean;
  enquireEnabled: boolean;
  enquireLabel: string;
  whatsappLabel: string;
};

export type ProductContactOverride = {
  contactUseCustom?: boolean;
  contactEnquireEnabled?: boolean;
  contactWhatsappEnabled?: boolean;
  contactWhatsappNumber?: string;
  contactEnquireLabel?: string;
  contactWhatsappLabel?: string;
};

export type ViewerContact = {
  enquireEnabled: boolean;
  enquireLabel: string;
  whatsappEnabled: boolean;
  whatsappLabel: string;
  whatsappNumber: string;
};

export type ProductEnquiryRecord = {
  id: number;
  enquiryUid: string;
  customerUid: string;
  workspaceUid: string | null;
  clientUid: string | null;
  productId: string;
  productTitle: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  message: string | null;
  status: EnquiryStatus;
  source: string;
  viewerUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_CONTACT_SETTINGS: WorkspaceContactSettings = {
  whatsappNumber: "",
  whatsappEnabled: false,
  enquireEnabled: false,
  enquireLabel: "Enquire",
  whatsappLabel: "WhatsApp",
};

export const ENQUIRY_STATUSES: EnquiryStatus[] = ["new", "contacted", "converted", "closed"];
