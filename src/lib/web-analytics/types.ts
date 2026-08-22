export type WebPresenceStatus = "live" | "idle" | "offline";

export type WebAnalyticsClientPayload = {
  visitorId: string;
  sessionId: string;
  path?: string;
  pageTitle?: string;
  referrer?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  customerUid?: string | null;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  durationSeconds?: number;
  /** Business / stream event override (e.g. login, signup). */
  event?: string;
};

export type LiveVisitorRow = {
  visitorId: string;
  label: string;
  sessionId: string;
  location: string;
  country: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  currentPage: string;
  startedAt: string;
  lastActiveAt: string;
  status: WebPresenceStatus;
  referrer?: string;
};

export type ActivityFeedItem = {
  id: number;
  event: string;
  visitorId: string;
  label: string;
  path: string;
  createdAt: string;
  summary: string;
};
