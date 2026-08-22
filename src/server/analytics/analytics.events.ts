import type { AnalyticsEventName } from "./analytics.types";

export const ANALYTICS_EVENTS = {
  VIEWER_OPEN: "viewer_open" as AnalyticsEventName,
  VIEWER_CLOSE: "viewer_close" as AnalyticsEventName,
  VIEWER_LOADED: "viewer_loaded" as AnalyticsEventName,
  VIEWER_ERROR: "viewer_error" as AnalyticsEventName,
  VIEWER_ROTATE: "viewer_rotate" as AnalyticsEventName,
  VIEWER_ZOOM: "viewer_zoom" as AnalyticsEventName,
  VIEWER_PAN: "viewer_pan" as AnalyticsEventName,
  AR_BUTTON_CLICK: "ar_button_click" as AnalyticsEventName,
  AR_LAUNCH_SUCCESS: "ar_launch_success" as AnalyticsEventName,
  AR_LAUNCH_FAILED: "ar_launch_failed" as AnalyticsEventName,
  SCREENSHOT: "screenshot" as AnalyticsEventName,
  SHARE_NATIVE: "share_native" as AnalyticsEventName,
  SHARE_VIEW: "share_view" as AnalyticsEventName,
  COPY_LINK: "copy_link" as AnalyticsEventName,
  DOWNLOAD_QR: "download_qr" as AnalyticsEventName,
  QR_SCAN: "qr_scan" as AnalyticsEventName,
  OPEN_EMBED: "open_embed" as AnalyticsEventName,
  EMBED_OPEN: "embed_open" as AnalyticsEventName,
  HOTSPOT_CLICK: "hotspot_click" as AnalyticsEventName,
  LOGO_CLICK: "logo_click" as AnalyticsEventName,
  VARIANT_CHANGE: "variant_change" as AnalyticsEventName,
  MATERIAL_CHANGE: "material_change" as AnalyticsEventName,
  POSTER_DOWNLOAD: "poster_download" as AnalyticsEventName,
  CTA_CLICK: "cta_click" as AnalyticsEventName,
  ENQUIRY_OPEN: "enquiry_open" as AnalyticsEventName,
  ENQUIRY_SUBMIT: "enquiry_submit" as AnalyticsEventName,
  WHATSAPP_CLICK: "whatsapp_click" as AnalyticsEventName,
} as const;

/** Continuous gestures — debounce on the client. */
export const DEBOUNCED_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  "viewer_rotate",
  "viewer_zoom",
  "viewer_pan",
]);

/** Viewer page opens only (not embeds). */
export const VIEW_EVENTS: ReadonlySet<AnalyticsEventName> = new Set(["viewer_open"]);

/**
 * AR opens KPI — success only.
 * Click / onboarding open must NOT inflate AR Opens.
 */
export const AR_EVENTS: ReadonlySet<AnalyticsEventName> = new Set(["ar_launch_success"]);

/** QR scan KPI — server redirect only. Legacy download_qr still counted for back-compat. */
export const QR_EVENTS: ReadonlySet<AnalyticsEventName> = new Set(["qr_scan", "download_qr"]);

/** Embed opens — separate from viewer_open. */
export const EMBED_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  "open_embed",
  "embed_open",
]);

/** Normalize aliases before persistence. */
export function canonicalizeAnalyticsEvent(event: AnalyticsEventName): AnalyticsEventName {
  if (event === "download_qr") return "qr_scan";
  if (event === "embed_open") return "open_embed";
  return event;
}
