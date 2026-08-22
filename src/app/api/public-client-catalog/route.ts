import { NextResponse } from "next/server";
import { getPublicClientCatalog } from "@/lib/user-panel/client-catalog";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const limited = await enforceRateLimit(req, {
      scope: "public-client-catalog:get",
      limit: 60,
      windowSec: 60,
    });
    if (limited instanceof Response) return limited;

    const url = new URL(req.url);
    const clientUid = String(url.searchParams.get("client") || "").trim();
    if (!clientUid) {
      return NextResponse.json(
        { success: false, enabled: false, error: "client is required." },
        { status: 400 },
      );
    }

    const catalog = await getPublicClientCatalog(clientUid, url.origin);
    if (!catalog) {
      return NextResponse.json(
        { success: false, enabled: false, error: "Client not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        enabled: catalog.enabled,
        clientUid: catalog.clientUid,
        clientName: catalog.clientName,
        logoUrl: catalog.logoUrl || "",
        brandPrimary: catalog.brandPrimary || "",
        logoDesign: catalog.logoDesign || null,
        products: catalog.products,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/public-client-catalog error:", error);
    return NextResponse.json({ error: "Failed to load catalog." }, { status: 500 });
  }
}
