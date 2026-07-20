import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  const dbStart = Date.now();
  try {
    await query<{ ok: number }>("SELECT 1 AS ok");
    dbOk = true;
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "healthy" : "degraded";

  return NextResponse.json({
    ok: dbOk,
    service: "AR360 Studio",
    status,
    version: "0.1.0",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    db: { connected: dbOk, latencyMs: dbLatencyMs },
    timestamp: new Date().toISOString(),
  }, { status: dbOk ? 200 : 503 });
}
