// ─── Core event names ────────────────────────────────────────────────────────

export type AnalyticsEventName =
  | "viewer_open"
  | "viewer_close"
  | "viewer_loaded"
  | "viewer_error"
  | "viewer_rotate"
  | "viewer_zoom"
  | "viewer_pan"
  | "ar_button_click"
  | "ar_launch_success"
  | "ar_launch_failed"
  | "screenshot"
  | "share_native"
  | "share_view"
  | "copy_link"
  | "download_qr"
  | "qr_scan"
  | "open_embed"
  | "embed_open"
  | "hotspot_click"
  | "logo_click"
  | "variant_change"
  | "material_change"
  | "poster_download"
  | "cta_click"
  | "enquiry_open"
  | "enquiry_submit"
  | "whatsapp_click";

// ─── Device / browser detection ──────────────────────────────────────────────

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";
export type OSName =
  | "iOS"
  | "Android"
  | "Windows"
  | "macOS"
  | "Linux"
  | "ChromeOS"
  | "unknown";
export type BrowserName =
  | "Chrome"
  | "Safari"
  | "Firefox"
  | "Edge"
  | "Samsung Internet"
  | "Opera"
  | "unknown";

// ─── Raw event payload sent from client ──────────────────────────────────────

export interface AnalyticsEventPayload {
  event: AnalyticsEventName;
  productUid: string;
  customerUid?: string;
  sessionId: string;
  meta?: Record<string, string | number | boolean>;
  // client-side collected
  screenWidth?: number;
  screenHeight?: number;
  language?: string;
  referrer?: string;
  url?: string;
}

// ─── DB row shapes ────────────────────────────────────────────────────────────

export interface AnalyticsEventRow {
  id: number;
  customer_uid: string;
  product_uid: string;
  session_id: string;
  event: AnalyticsEventName;
  device: DeviceType;
  browser: BrowserName;
  os: OSName;
  country: string;
  city: string;
  language: string;
  screen_width: number;
  screen_height: number;
  referrer: string;
  url: string;
  ip_hash: string;
  meta: string; // JSON string
  created_at: string;
}

export interface AnalyticsSessionRow {
  session_id: string;
  customer_uid: string;
  product_uid: string;
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  device: DeviceType;
  browser: BrowserName;
  os: OSName;
  country: string;
  city: string;
}

export interface AnalyticsDailyRow {
  id: number;
  customer_uid: string;
  product_uid: string;
  date: string; // YYYY-MM-DD
  views: number;
  unique_visitors: number;
  ar_launches: number;
  screenshots: number;
  shares: number;
  copy_links: number;
  qr_scans: number;
  avg_duration: number;
}

// ─── Dashboard response shapes ────────────────────────────────────────────────

export interface DashboardSummary {
  totalViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  arLaunches: number;
  screenshots: number;
  shares: number;
  copyLinks: number;
  qrScans: number;
  shareViews?: number;
  embedViews?: number;
  ctaClicks?: number;
  arButtonClicks?: number;
  avgSessionDuration: number; // seconds
  bounceRate: number; // 0-100
}

export interface DashboardData {
  summary: DashboardSummary;
  daily: DailyPoint[];
  topProducts: TopProduct[];
  topCountries: TopCountry[];
  topCities?: TopCity[];
  devices: DeviceBreakdown[];
  browsers: BrowserBreakdown[];
  operatingSystems: OSBreakdown[];
  referrers: ReferrerBreakdown[];
  growth?: {
    trafficSources: Array<{ source: string; count: number }>;
    insights?: Array<{ title?: string; body?: string; message?: string; category?: string }>;
  };
}

export interface DailyPoint {
  date: string;
  views: number;
  arLaunches: number;
  screenshots: number;
}

export interface TopProduct {
  productUid: string;
  title: string;
  views: number;
  uniqueVisitors: number;
  arLaunches: number;
}

export interface TopCountry {
  country: string;
  views: number;
  percent: number;
}

export interface TopCity {
  city: string;
  country: string;
  label: string;
  views: number;
  percent: number;
}

export interface DeviceBreakdown {
  device: DeviceType;
  views: number;
  percent: number;
}

export interface BrowserBreakdown {
  browser: BrowserName;
  views: number;
  percent: number;
}

export interface OSBreakdown {
  os: OSName;
  views: number;
  percent: number;
}

export interface ReferrerBreakdown {
  referrer: string;
  views: number;
  percent: number;
}

// ─── Filter params ────────────────────────────────────────────────────────────

export interface AnalyticsFilter {
  customerUid?: string;
  productUid?: string;
  from?: string; // ISO date
  to?: string;
  country?: string;
  device?: DeviceType;
  browser?: BrowserName;
  os?: OSName;
}

// ─── Export formats ───────────────────────────────────────────────────────────

export type ExportFormat = "excel";
