import { NextResponse } from "next/server";
import { ensureSiteWebAnalyticsSchema } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { WebAnalyticsClientPayload } from "@/lib/web-analytics/types";
import {
  endWebSession,
  heartbeatWebSession,
  recordWebPageView,
  startWebSession,
} from "@/lib/web-analytics/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await ensureSiteWebAnalyticsSchema();
  schemaReady = true;
}

async function withGuard(request: Request, scope: string, run: () => Promise<unknown>) {
  try {
    const limited = await enforceRateLimit(request, { scope, limit: 120, windowSec: 60 });
    if (limited instanceof Response) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    await ensureSchema();
    const result = await run();
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    console.error(`[web-analytics/${scope}]`, error);
    // Fail closed for rate-limit issues already handled; otherwise silent ok for trackers.
    if (error instanceof Error && /required|Invalid/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

function bodyOf(request: Request) {
  return request.json() as Promise<Partial<WebAnalyticsClientPayload>>;
}

export async function handleSession(request: Request) {
  return withGuard(request, "web-analytics:session", async () => {
    const body = await bodyOf(request);
    return startWebSession(body as WebAnalyticsClientPayload, request);
  });
}

export async function handlePageView(request: Request) {
  return withGuard(request, "web-analytics:page-view", async () => {
    const body = await bodyOf(request);
    return recordWebPageView(body as WebAnalyticsClientPayload, request);
  });
}

export async function handleHeartbeat(request: Request) {
  return withGuard(request, "web-analytics:heartbeat", async () => {
    const body = await bodyOf(request);
    return heartbeatWebSession(body as WebAnalyticsClientPayload, request);
  });
}

export async function handleSessionEnd(request: Request) {
  return withGuard(request, "web-analytics:session-end", async () => {
    const body = await bodyOf(request);
    return endWebSession(body as WebAnalyticsClientPayload);
  });
}
