import { NextResponse } from "next/server";
import { ensureAnalyticsSchema } from "@/lib/db";
import { trackEvent } from "@/server/analytics/analytics.service";
import type { AnalyticsEventPayload, AnalyticsEventName } from "@/server/analytics/analytics.types";
import { canonicalizeAnalyticsEvent } from "@/server/analytics/analytics.events";
import { normalizeScopedId } from "@/lib/customerIsolation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { resolveProduct } from "@/server/products/product-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await ensureAnalyticsSchema();
  schemaReady = true;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = await enforceRateLimit(request, { scope: "analytics:event", limit: 120, windowSec: 60 });
    if (limited instanceof Response) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    await ensureSchema();

    let body: Partial<AnalyticsEventPayload> = {};
    try {
      const text = await request.text();
      body = JSON.parse(text) as Partial<AnalyticsEventPayload>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawProductUid = normalizeScopedId(body.productUid);
    const sessionId = String(body.sessionId || "").trim().slice(0, 191);

    if (!body.event || !rawProductUid || !sessionId) {
      return NextResponse.json(
        { error: "event, productUid and sessionId are required" },
        { status: 400 },
      );
    }

    const resolved = await resolveProduct(rawProductUid).catch(() => null);
    const event = canonicalizeAnalyticsEvent(body.event as AnalyticsEventName);

    const payload: AnalyticsEventPayload = {
      event,
      productUid: resolved?.productId ?? rawProductUid,
      customerUid: resolved?.customerUid ?? "anonymous",
      sessionId,
      meta: body.meta,
      screenWidth: body.screenWidth,
      screenHeight: body.screenHeight,
      language: body.language,
      referrer: body.referrer,
      url: body.url,
    };

    await trackEvent(payload, request);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[analytics/event]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
