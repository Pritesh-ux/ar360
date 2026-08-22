export type ClientWorkspaceClient = {
  client_uid: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  tags: string | string[] | null;
  created_at: string;
  plan_starts_at?: string | Date | null;
  plan_expires_at?: string | Date | null;
  link_expires_at?: string | Date | null;
  viewer_catalog_enabled?: boolean | number;
  logo_url?: string | null;
  brand_primary?: string | null;
  brand_theme?: string | null;
  branding_json?: unknown;
  viewer_title?: string | null;
  notes?: string | null;
  powered_by_label?: string | null;
};

export type ClientWorkspaceProduct = {
  product_uid: string;
  public_id?: string | null;
  name: string;
  status: string;
  created_at: string;
  category?: string | null;
  poster?: string | null;
  thumbnail_url?: string | null;
  file_name?: string | null;
  views?: number | null;
  product_folder?: string | null;
  viewer_active?: boolean | number;
};

export type ClientWorkspaceQr = {
  id?: number;
  qr_uid: string;
  name: string;
  status: string;
  scans_count: number;
  created_at: string;
  product_id?: string;
  product_title?: string | null;
  qr_image_url?: string | null;
  image_url?: string | null;
};

export type ClientWorkspaceDomain = {
  domain: string;
  status: string;
  ssl_status: string;
  created_at: string;
};

export type ClientWorkspaceActivity = {
  action: string;
  resource_type: string;
  resource_id: string;
  created_at: string;
};

export type ClientWorkspaceData = {
  client: ClientWorkspaceClient;
  products: ClientWorkspaceProduct[];
  qrCodes: ClientWorkspaceQr[];
  domains: ClientWorkspaceDomain[];
  activities: ClientWorkspaceActivity[];
};

export type ClientWorkspaceTab = "products" | "branding" | "settings";

export const CLIENT_ACCENT = "#C6FF32";
