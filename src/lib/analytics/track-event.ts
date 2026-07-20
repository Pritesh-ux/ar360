import type { AnalyticsEventName } from "@/server/analytics/analytics.types";

const SESSION_KEY = "ar360_analytics_session";

export function getAnalyticsSessionId(): string {
  if (typeof window === "undefined") return "server-session";

  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export type TrackAnalyticsEventOptions = {
  event: AnalyticsEventName;
  productUid: string;
  meta?: Record<string, unknown>;
};

export function trackAnalyticsEvent({
  event,
  productUid,
  meta = {},
}: TrackAnalyticsEventOptions): void {
  if (typeof window === "undefined") return;
  if (!productUid?.trim()) return;

  const payload = {
    event,
    productUid: productUid.trim(),
    sessionId: getAnalyticsSessionId(),
    meta,
    screenWidth: window.screen?.width ?? window.innerWidth,
    screenHeight: window.screen?.height ?? window.innerHeight,
    language: navigator.language,
    referrer: document.referrer || "direct",
    url: window.location.href,
  };

  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Analytics must not block UX.
  });
}

export function mapARExperienceEventToAnalytics(
  event: string,
  meta: Record<string, unknown> = {},
): AnalyticsEventName | null {
  if (event === "ar_return_to_viewer") {
    const action = meta.action;
    if (action === "copy_link") return "copy_link";
    if (action === "native_share") return "share_native";
    if (action === "screenshot") return "screenshot";
    return "viewer_open";
  }

  const direct: Record<string, AnalyticsEventName> = {
    ar_onboarding_open: "ar_button_click",
    ar_launch_success: "ar_launch_success",
    ar_launch_failed: "ar_launch_failed",
    ar_link_copy: "copy_link",
    ar_mobile_share: "share_native",
  };

  return direct[event] ?? null;
}

export function mapViewerEventToAnalytics(type: string): AnalyticsEventName | null {
  const map: Record<string, AnalyticsEventName> = {
    viewer_open: "viewer_open",
    embed_open: "open_embed",
    qr_scan: "download_qr",
    ar_open: "ar_button_click",
    share_copy: "copy_link",
    embed_copy: "copy_link",
    variant_change: "variant_change",
  };

  return map[type] ?? null;
}
