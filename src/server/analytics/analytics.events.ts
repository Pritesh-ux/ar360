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
  COPY_LINK: "copy_link" as AnalyticsEventName,
  DOWNLOAD_QR: "download_qr" as AnalyticsEventName,
  OPEN_EMBED: "open_embed" as AnalyticsEventName,
  HOTSPOT_CLICK: "hotspot_click" as AnalyticsEventName,
  LOGO_CLICK: "logo_click" as AnalyticsEventName,
  VARIANT_CHANGE: "variant_change" as AnalyticsEventName,
  MATERIAL_CHANGE: "material_change" as AnalyticsEventName,
  POSTER_DOWNLOAD: "poster_download" as AnalyticsEventName,
} as const;

// Events that should be debounced on the client (continuous gestures)
export const DEBOUNCED_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  "viewer_rotate",
  "viewer_zoom",
  "viewer_pan",
]);

// Events that increment the daily views counter
export const VIEW_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  "viewer_open",
]);

// Events that increment the AR launches counter
export const AR_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  "ar_launch_success",
  "ar_button_click",
]);
