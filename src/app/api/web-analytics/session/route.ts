import { handleSession } from "@/lib/web-analytics/public-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleSession(request);
}
