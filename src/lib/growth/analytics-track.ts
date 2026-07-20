import { trackEvent } from "@/server/analytics/analytics.service";
import type { AnalyticsEventName } from "@/server/analytics/analytics.types";

export async function trackAnalyticsFromServer(input: {
  event: AnalyticsEventName;
  customerUid: string;
  productUid: string;
  sessionId: string;
  request: Request;
  meta?: Record<string, unknown>;
}) {
  await trackEvent(
    {
      event: input.event,
      customerUid: input.customerUid,
      productUid: input.productUid,
      sessionId: input.sessionId,
      meta: input.meta as Record<string, string | number | boolean>,
      referrer: input.request.headers.get("referer") || "",
      url: input.request.url,
    },
    input.request,
  );
}
