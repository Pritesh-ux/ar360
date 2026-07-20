import { NextResponse } from "next/server";
import { ensureAnalyticsSchema, query } from "@/lib/db";
import { trackEvent } from "@/server/analytics/analytics.service";
import type { AnalyticsEventPayload } from "@/server/analytics/analytics.types";
import { normalizeScopedId } from "@/lib/customerIsolation";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await ensureAnalyticsSchema();
  schemaReady = true;
}

async function resolveProductCustomerUid(productUid: string) {
  const rows = await query<{ customer_uid: string }>(
    "SELECT customer_uid FROM products WHERE id = ? OR public_id = ? OR viewer_slug = ? LIMIT 1",
    [productUid, productUid, productUid],
  ).catch(() => []);
  return rows[0]?.customer_uid || "anonymous";
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limited = await enforceRateLimit(request, { scope: "analytics:event", limit: 120, windowSec: 60 });
    if (limited instanceof Response) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    await ensureSchema();

    const body = (await request.json()) as Partial<AnalyticsEventPayload>;

    const productUid = normalizeScopedId(body.productUid);
    const sessionId = String(body.sessionId || "").trim().slice(0, 191);

    if (!body.event || !productUid || !sessionId) {
      return NextResponse.json(
        { error: "event, productUid and sessionId are required" },
        { status: 400 },
      );
    }

    const payload: AnalyticsEventPayload = {
      event: body.event,
      productUid,
      customerUid: await resolveProductCustomerUid(productUid),
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
